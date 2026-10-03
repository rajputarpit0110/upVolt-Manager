import { Request, Response } from 'express';
import { Product } from '../models/Product';
import { ProductPriceHistory } from '../models/ProductPriceHistory';
import { StockMovement } from '../models/StockMovement';
import { InventoryBatch } from '../models/InventoryBatch';
import { Order } from '../models/Order';
import { createAuditLog } from '../services/auditService';

export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      search,
      category,
      stockStatus,
      deadStock,
      page = '1',
      limit = '50',
      sortBy = 'name',
      sortOrder = 'asc',
    } = req.query;

    const query: any = { isArchived: false };

    if (search) {
      const regex = new RegExp(String(search), 'i');
      query.$or = [{ name: regex }, { sku: regex }, { category: regex }, { brand: regex }];
    }

    if (category) {
      query.category = category;
    }

    if (stockStatus === 'OUT_OF_STOCK') {
      query.currentStock = 0;
    } else if (stockStatus === 'LOW_STOCK') {
      query.$expr = {
        $and: [
          { $gt: ['$currentStock', 0] },
          { $lte: ['$currentStock', '$minStockLevel'] },
        ],
      };
    } else if (stockStatus === 'IN_STOCK') {
      query.$expr = { $gt: ['$currentStock', '$minStockLevel'] };
    }

    // Dead Stock filter: Products with no sales in the past N days
    if (deadStock === 'true') {
      const days = parseInt(req.query.deadDays as string) || 30;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      const recentSoldIds = await Order.distinct('items.productId', {
        orderDate: { $gte: cutoff },
        isDeleted: false,
        status: { $ne: 'Cancelled' },
      });

      query.currentStock = { $gt: 0 };
      query._id = { $nin: recentSoldIds };
    }

    const sortOptions: any = {};
    sortOptions[String(sortBy)] = sortOrder === 'desc' ? -1 : 1;

    const skip = (parseInt(String(page)) - 1) * parseInt(String(limit));
    const total = await Product.countDocuments(query);
    const rawProducts = await Product.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(String(limit)));

    const products = req.user?.role === 'CAMPUS_EXECUTIVE'
      ? rawProducts.map((p) => {
          const po: any = p.toObject();
          delete po.costPrice;
          return po;
        })
      : rawProducts;

    res.json({
      success: true,
      products,
      pagination: {
        total,
        page: parseInt(String(page)),
        pages: Math.ceil(total / parseInt(String(limit))),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getProductById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) {
      res.status(404).json({ success: false, message: 'Product not found.' });
      return;
    }

    // Get active batches for this product
    const batches = await InventoryBatch.find({ productId: id }).sort({ receivedDate: -1 });

    // Get price history
    const priceHistory = await ProductPriceHistory.find({ productId: id }).sort({ createdAt: -1 });

    // Get recent stock movements
    const movements = await StockMovement.find({ productId: id }).sort({ createdAt: -1 }).limit(20);

    // Get lifetime analytics for this product
    const ordersWithProduct = await Order.find({
      'items.productId': id,
      isDeleted: false,
      status: { $ne: 'Cancelled' },
    });

    let unitsSold = 0;
    let totalRevenue = 0;
    let totalCogs = 0;

    for (const order of ordersWithProduct) {
      for (const item of order.items) {
        if (item.productId.toString() === id) {
          unitsSold += item.quantity;
          totalRevenue += item.revenue;
          totalCogs += item.cogs;
        }
      }
    }

    const totalProfit = totalRevenue - totalCogs;
    const grossMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    res.json({
      success: true,
      product,
      batches,
      priceHistory,
      movements,
      analytics: {
        unitsSold,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalCogs: Math.round(totalCogs * 100) / 100,
        totalProfit: Math.round(totalProfit * 100) / 100,
        grossMargin: Math.round(grossMargin * 100) / 100,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      sku,
      category,
      brand,
      modelNumber,
      description,
      imageUrl,
      supplier,
      minStockLevel,
      unit,
      locationShelf,
      specifications,
      tags,
      notes,
      sellingPrice,
      costPrice,
      initialQuantity,
      billPhoto,
      attachmentUrl,
      isFromInventory,
    } = req.body;

    const billDocument = billPhoto || attachmentUrl;

    // MANDATORY VALIDATION FOR NEW PRODUCTS FROM INVENTORY
    if (isFromInventory || (initialQuantity !== undefined && Number(initialQuantity) > 0)) {
      if (costPrice === undefined || costPrice === null || Number(costPrice) <= 0) {
        res.status(400).json({
          success: false,
          message: 'Cost Price is mandatory for adding a new product to inventory.',
        });
        return;
      }
      if (!billDocument || !String(billDocument).trim()) {
        res.status(400).json({
          success: false,
          message: 'Purchase bill/invoice is required for a new product.',
        });
        return;
      }
    }

    if (!name || !category || sellingPrice === undefined) {
      res.status(400).json({
        success: false,
        message: 'Product Name, Category, and Selling Price are required.',
      });
      return;
    }

    // Auto-generate SKU if user didn't specify one
    let cleanSku = sku ? sku.toUpperCase().trim() : '';
    if (!cleanSku) {
      const catPrefix = category.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X') || 'ITM';
      const namePart = name.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X') || 'PRD';
      const randHex = Math.floor(1000 + Math.random() * 9000);
      cleanSku = `${catPrefix}-${namePart}-${randHex}`;
    }

    const existing = await Product.findOne({ sku: cleanSku });
    if (existing) {
      res.status(400).json({ success: false, message: `Product with SKU "${cleanSku}" already exists.` });
      return;
    }

    const qty = initialQuantity ? Number(initialQuantity) : 0;
    const cp = costPrice !== undefined ? Number(costPrice) : 0;

    const product = new Product({
      name: name.trim(),
      sku: cleanSku,
      category: category.trim(),
      brand: brand?.trim(),
      modelNumber: modelNumber?.trim(),
      description: description?.trim(),
      imageUrl: imageUrl?.trim() || billDocument || '',
      supplier: supplier?.trim(),
      currentStock: qty,
      reservedStock: 0,
      minStockLevel: minStockLevel !== undefined ? Number(minStockLevel) : 10,
      unit: unit || 'pcs',
      locationShelf: locationShelf?.trim(),
      specifications: specifications || {},
      tags: tags || [],
      notes: notes?.trim(),
      sellingPrice: Number(sellingPrice),
      averageCost: cp,
      isArchived: false,
    });

    await product.save();

    // If initial stock was supplied with bill, record Purchase & StockMovement
    if (qty > 0) {
      const { Purchase } = await import('../models/Purchase');
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const countPurchases = await Purchase.countDocuments();
      const purchaseNumber = `PUR-${dateStr}-${String(countPurchases + 1).padStart(4, '0')}`;
      const batchNumber = `BATCH-${dateStr}-${cleanSku}`;

      await Purchase.create({
        purchaseNumber,
        supplierName: supplier?.trim() || 'Direct Vendor Purchase',
        purchaseDate: new Date(),
        items: [
          {
            productId: product._id,
            productName: product.name,
            sku: product.sku,
            quantity: qty,
            costPrice: cp,
            totalCost: Math.round(qty * cp * 100) / 100,
            batchNumber,
          },
        ],
        totalAmount: Math.round(qty * cp * 100) / 100,
        paymentStatus: 'PAID',
        attachmentUrl: billDocument,
        receivedBy: req.user?.userId || 'admin',
        isCancelled: false,
      });

      await StockMovement.create({
        productId: product._id,
        movementType: 'STOCK_RECEIVED',
        quantity: qty,
        previousStock: 0,
        newStock: qty,
        referenceType: 'PURCHASE',
        referenceId: purchaseNumber,
        costPrice: cp,
        performedBy: req.user?.userId || 'admin',
        notes: `Initial stock entry for new product ${product.name} with bill`,
      });
    }

    await createAuditLog({
      userId: req.user!.userId,
      userName: req.user!.name,
      role: req.user!.role,
      action: 'CREATE_PRODUCT',
      entityType: 'PRODUCT',
      entityId: product._id.toString(),
      newState: { name: product.name, sku: product.sku, sellingPrice: product.sellingPrice, currentStock: qty },
      ip: req.ip,
    });

    res.status(201).json({ success: true, product });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) {
      res.status(404).json({ success: false, message: 'Product not found.' });
      return;
    }

    const {
      name,
      category,
      brand,
      modelNumber,
      description,
      imageUrl,
      supplier,
      minStockLevel,
      unit,
      locationShelf,
      specifications,
      tags,
      notes,
      sellingPrice,
      priceChangeReason,
    } = req.body;

    // Track selling price changes in ProductPriceHistory
    if (sellingPrice !== undefined && Number(sellingPrice) !== product.sellingPrice) {
      const oldPrice = product.sellingPrice;
      const newPrice = Number(sellingPrice);

      await new ProductPriceHistory({
        productId: product._id,
        type: 'SELLING_PRICE',
        oldPrice,
        newPrice,
        changedBy: req.user!.userId,
        reason: priceChangeReason || 'Price updated in product editor',
      }).save();

      product.sellingPrice = newPrice;
    }

    if (name) product.name = name.trim();
    if (category) product.category = category.trim();
    if (brand !== undefined) product.brand = brand?.trim();
    if (modelNumber !== undefined) product.modelNumber = modelNumber?.trim();
    if (description !== undefined) product.description = description?.trim();
    if (imageUrl !== undefined) product.imageUrl = imageUrl?.trim();
    if (supplier !== undefined) product.supplier = supplier?.trim();
    if (minStockLevel !== undefined) product.minStockLevel = Number(minStockLevel);
    if (unit !== undefined) product.unit = unit;
    if (locationShelf !== undefined) product.locationShelf = locationShelf?.trim();
    if (specifications !== undefined) product.specifications = specifications;
    if (tags !== undefined) product.tags = tags;
    if (notes !== undefined) product.notes = notes?.trim();

    await product.save();

    await createAuditLog({
      userId: req.user!.userId,
      userName: req.user!.name,
      role: req.user!.role,
      action: 'UPDATE_PRODUCT',
      entityType: 'PRODUCT',
      entityId: product._id.toString(),
      newState: { name: product.name, sellingPrice: product.sellingPrice },
      ip: req.ip,
    });

    res.json({ success: true, product });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const adjustStock = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { quantity, direction, reason, condition = 'GOOD', notes } = req.body;

    if (!quantity || !direction || !reason) {
      res.status(400).json({
        success: false,
        message: 'Quantity, Direction (IN/OUT), and Reason are required.',
      });
      return;
    }

    const qty = Math.abs(Number(quantity));
    if (qty <= 0) {
      res.status(400).json({ success: false, message: 'Quantity must be strictly positive.' });
      return;
    }

    const product = await Product.findById(id);
    if (!product) {
      res.status(404).json({ success: false, message: 'Product not found.' });
      return;
    }

    const previousStock = product.currentStock;
    let newStock = previousStock;
    let movementType: any = 'ADJUSTMENT';

    if (direction === 'OUT') {
      if (product.currentStock < qty) {
        res.status(400).json({
          success: false,
          message: `Cannot deduct ${qty} units. Current physical stock is only ${product.currentStock}.`,
        });
        return;
      }
      newStock = previousStock - qty;
      product.currentStock = newStock;
      if (condition === 'DAMAGED' || condition === 'DEFECTIVE') {
        product.damagedStock += qty;
        movementType = 'DAMAGE';
      }
    } else {
      newStock = previousStock + qty;
      product.currentStock = newStock;
      movementType = 'MANUAL_CORRECTION';
    }

    await product.save();

    const movement = new StockMovement({
      productId: product._id,
      movementType,
      quantity: direction === 'OUT' ? -qty : qty,
      previousStock,
      newStock,
      previousReserved: product.reservedStock,
      newReserved: product.reservedStock,
      referenceType: 'ADJUSTMENT',
      referenceId: `ADJ-${Date.now().toString().slice(-6)}`,
      condition,
      performedBy: req.user!.userId,
      notes: `${reason}. ${notes || ''}`.trim(),
    });
    await movement.save();

    await createAuditLog({
      userId: req.user!.userId,
      userName: req.user!.name,
      role: req.user!.role,
      action: 'STOCK_ADJUSTMENT',
      entityType: 'PRODUCT',
      entityId: product._id.toString(),
      newState: { previousStock, newStock, adjustment: direction === 'OUT' ? -qty : qty },
      reason,
      ip: req.ip,
    });

    res.json({ success: true, product, movement });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Generates official product inventory ledger from StockMovement records
 * (Requirement 20)
 */
export const getProductLedger = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) {
      res.status(404).json({ success: false, message: 'Product not found.' });
      return;
    }

    // Chronological order from oldest to newest
    const movements = await StockMovement.find({ productId: id }).sort({ createdAt: 1 });

    const ledger = movements.map((m) => {
      const isPositive = m.quantity > 0;
      return {
        date: m.createdAt,
        type: m.movementType,
        reference: m.referenceId || '-',
        qtyIn: isPositive ? m.quantity : 0,
        qtyOut: !isPositive ? Math.abs(m.quantity) : 0,
        balance: m.newStock,
        unitCost: m.costPrice !== undefined ? m.costPrice : product.averageCost,
        value: Math.round(m.newStock * (m.costPrice || product.averageCost) * 100) / 100,
        performedBy: m.performedBy,
        notes: m.notes,
      };
    });

    res.json({
      success: true,
      product: { name: product.name, sku: product.sku, currentStock: product.currentStock },
      ledger,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
