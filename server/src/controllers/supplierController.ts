import { Request, Response } from 'express';
import { Supplier } from '../models/Supplier';
import { Purchase } from '../models/Purchase';
import { createAuditLog } from '../services/auditService';

export const getSuppliers = async (req: Request, res: Response): Promise<void> => {
  try {
    const suppliers = await Supplier.find().sort({ name: 1 });
    res.json({ success: true, suppliers });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSupplierById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const supplier = await Supplier.findById(id);
    if (!supplier) {
      res.status(404).json({ success: false, message: 'Supplier not found' });
      return;
    }

    const purchases = await Purchase.find({ supplierId: id }).sort({ purchaseDate: -1 });
    const totalPurchased = purchases.reduce((sum, p) => sum + p.totalAmount, 0);

    res.json({
      success: true,
      supplier,
      purchases,
      stats: {
        totalPurchasesCount: purchases.length,
        totalPurchasedAmount: Math.round(totalPurchased * 100) / 100,
        lastPurchaseDate: purchases[0]?.purchaseDate || null,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, contactPerson, phone, email, address, gstin, notes } = req.body;
    if (!name) {
      res.status(400).json({ success: false, message: 'Supplier name is required.' });
      return;
    }

    const supplier = new Supplier({
      name: name.trim(),
      contactPerson: contactPerson?.trim(),
      phone: phone?.trim(),
      email: email?.trim(),
      address: address?.trim(),
      gstin: gstin?.trim(),
      notes: notes?.trim(),
      isActive: true,
    });
    await supplier.save();

    await createAuditLog({
      userId: req.user!.userId,
      userName: req.user!.name,
      role: req.user!.role,
      action: 'CREATE_SUPPLIER',
      entityType: 'SUPPLIER',
      entityId: supplier._id.toString(),
      newState: { name: supplier.name, gstin: supplier.gstin },
      ip: req.ip,
    });

    res.status(201).json({ success: true, supplier });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const supplier = await Supplier.findByIdAndUpdate(id, req.body, { new: true });
    if (!supplier) {
      res.status(404).json({ success: false, message: 'Supplier not found.' });
      return;
    }
    res.json({ success: true, supplier });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
