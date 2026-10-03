import { Request, Response } from 'express';
import { Category } from '../models/Category';
import { Product } from '../models/Product';
import { AuditLog } from '../models/AuditLog';

// 8 Official Default Categories for UpVolt
export const DEFAULT_UPVOLT_CATEGORIES = [
  {
    name: 'Development Boards',
    slug: 'development-boards',
    description: 'Microcontrollers, ARM development boards, and programmable modules',
    order: 1,
    status: 'Active' as const,
    addedBy: 'upVolt Admin',
  },
  {
    name: 'Sensors',
    slug: 'sensors',
    description: 'Ultrasonic, environmental, motion, temperature, and gas detection sensors',
    order: 2,
    status: 'Active' as const,
    addedBy: 'upVolt Admin',
  },
  {
    name: 'Modules',
    slug: 'modules',
    description: 'Wi-Fi, Bluetooth, relay modules, step-down converters, and displays',
    order: 3,
    status: 'Active' as const,
    addedBy: 'upVolt Admin',
  },
  {
    name: 'IoT Kits',
    slug: 'iot-kits',
    description: 'Complete hands-on engineering project kits for students and makers',
    order: 4,
    status: 'Active' as const,
    addedBy: 'upVolt Admin',
  },
  {
    name: 'Motors & Drivers',
    slug: 'motors-drivers',
    description: 'DC gear motors, servos, stepper motors, and motor driver shields',
    order: 5,
    status: 'Active' as const,
    addedBy: 'upVolt Admin',
  },
  {
    name: 'Power & Components',
    slug: 'power-components',
    description: 'Power supplies, breadboards, voltage regulators, and ICs',
    order: 6,
    status: 'Active' as const,
    addedBy: 'upVolt Admin',
  },
  {
    name: 'Cables & Connectors',
    slug: 'cables-connectors',
    description: 'Dupont jumper wires, USB interface cables, headers, and crocodile clips',
    order: 7,
    status: 'Active' as const,
    addedBy: 'upVolt Admin',
  },
  {
    name: 'Project Kits',
    slug: 'project-kits',
    description: 'Smart weather kits, plant care kits, and robotic chassis systems',
    order: 8,
    status: 'Active' as const,
    addedBy: 'upVolt Admin',
  },
];

export async function ensureDefaultCategories(): Promise<void> {
  const count = await Category.countDocuments();
  if (count === 0) {
    for (const cat of DEFAULT_UPVOLT_CATEGORIES) {
      await Category.updateOne({ slug: cat.slug }, { $setOnInsert: cat }, { upsert: true });
    }
    console.log('[Seed] Initialized 8 official UpVolt product categories.');
  }
}

/**
 * GET /api/categories
 * Returns all categories with dynamic product counts.
 */
export const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    // Ensure default categories exist
    await ensureDefaultCategories();

    const categories = await Category.find().sort({ order: 1, createdAt: 1 });

    // Compute live product counts per category
    const productCounts = await Product.aggregate([
      { $match: { isArchived: false } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);

    const countMap = new Map<string, number>();
    productCounts.forEach((pc) => {
      countMap.set(pc._id, pc.count);
    });

    const enriched = categories.map((cat) => ({
      _id: cat._id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      status: cat.status,
      addedBy: cat.addedBy,
      order: cat.order,
      itemCount: countMap.get(cat.name) || 0,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
    }));

    res.json({ success: true, count: enriched.length, categories: enriched });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/categories
 * Accessible to ALL employees / users to create new categories dynamically.
 */
export const createCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description } = req.body;
    const user = (req as any).user;

    if (!name || !name.trim()) {
      res.status(400).json({ success: false, message: 'Category name is required' });
      return;
    }

    const trimmedName = name.trim();
    const slug = trimmedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Check uniqueness
    const existing = await Category.findOne({
      $or: [{ name: { $regex: new RegExp(`^${trimmedName}$`, 'i') } }, { slug }],
    });

    if (existing) {
      res.status(400).json({ success: false, message: `Category '${trimmedName}' already exists` });
      return;
    }

    const totalCategories = await Category.countDocuments();
    const creatorName = user?.name || user?.userId || 'Employee';

    const category = await Category.create({
      name: trimmedName,
      slug,
      description: description ? description.trim() : '',
      status: 'Active',
      addedBy: creatorName,
      order: totalCategories + 1,
    });

    // Audit log
    await AuditLog.create({
      userId: user?.userId || 'anonymous',
      userName: creatorName,
      role: user?.role || 'STAFF',
      action: 'CREATE_CATEGORY',
      entityType: 'CATEGORY',
      entityId: category._id.toString(),
      newState: { name: category.name, slug: category.slug, description: category.description },
      reason: `Employee ${creatorName} added new category: ${category.name}`,
    });

    res.status(201).json({
      success: true,
      message: `Category '${category.name}' created successfully`,
      category: {
        ...category.toObject(),
        itemCount: 0,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/categories/:id
 */
export const updateCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, status } = req.body;
    const user = (req as any).user;

    const category = await Category.findById(id);
    if (!category) {
      res.status(404).json({ success: false, message: 'Category not found' });
      return;
    }

    const oldName = category.name;
    if (name && name.trim()) {
      category.name = name.trim();
      category.slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
    if (description !== undefined) category.description = description.trim();
    if (status) category.status = status;

    await category.save();

    // If category name was renamed, optionally cascade update to products
    if (name && name.trim() !== oldName) {
      await Product.updateMany({ category: oldName }, { $set: { category: category.name } });
    }

    await AuditLog.create({
      userId: user?.userId || 'anonymous',
      userName: user?.name || 'Employee',
      role: user?.role || 'STAFF',
      action: 'UPDATE_CATEGORY',
      entityType: 'CATEGORY',
      entityId: category._id.toString(),
      newState: { name: category.name, description: category.description, status: category.status },
      reason: `Updated category ${oldName}`,
    });

    res.json({ success: true, message: 'Category updated successfully', category });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/categories/:id
 */
export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const category = await Category.findById(id);
    if (!category) {
      res.status(404).json({ success: false, message: 'Category not found' });
      return;
    }

    // Check if any product is using this category
    const productsUsing = await Product.countDocuments({ category: category.name, isArchived: false });
    if (productsUsing > 0) {
      res.status(400).json({
        success: false,
        message: `Cannot delete category '${category.name}' because ${productsUsing} product(s) are currently assigned to it. Reassign them first.`,
      });
      return;
    }

    await Category.findByIdAndDelete(id);

    await AuditLog.create({
      userId: user?.userId || 'anonymous',
      userName: user?.name || 'Employee',
      role: user?.role || 'STAFF',
      action: 'DELETE_CATEGORY',
      entityType: 'CATEGORY',
      entityId: id,
      previousState: { name: category.name, slug: category.slug },
      reason: `Deleted category ${category.name}`,
    });

    res.json({ success: true, message: `Category '${category.name}' deleted successfully` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
