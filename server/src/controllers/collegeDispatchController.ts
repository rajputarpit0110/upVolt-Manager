import { Request, Response } from 'express';
import {
  createCollegeDispatch,
  getCollegeDispatches,
  getCollegeInventory,
  getAllCollegesList,
} from '../services/collegeDispatchService';

export const createDispatch = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role === 'COLLEGE_MEMBER') {
      res.status(403).json({
        success: false,
        message: 'Access Denied: College members cannot dispatch hardware.',
      });
      return;
    }

    const { college, dispatchDate, items, notes } = req.body;

    const dispatch = await createCollegeDispatch({
      college,
      dispatchDate,
      items,
      dispatchedBy: req.user.userId,
      notes,
    });

    res.status(201).json({
      success: true,
      message: `Successfully dispatched ${dispatch.totalUnits} items to ${dispatch.college}. Central inventory updated.`,
      dispatch,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getDispatches = async (req: Request, res: Response): Promise<void> => {
  try {
    const isCollegeMember = req.user?.role === 'COLLEGE_MEMBER';
    let targetCollege = req.query.college as string | undefined;

    // Strict security enforcement: College Member can ONLY view their assigned college
    if (isCollegeMember) {
      if (!req.user?.college) {
        res.status(403).json({ success: false, message: 'No college assigned to your account.' });
        return;
      }
      targetCollege = req.user.college;
    }

    const dispatches = await getCollegeDispatches({
      college: targetCollege,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      dispatchedBy: req.query.dispatchedBy as string,
    });

    // If College Member, mask purchase/dispatch costs
    const sanitizedDispatches = dispatches.map((d) => {
      const doc = d.toObject();
      if (isCollegeMember) {
        delete (doc as any).totalCost;
        doc.items = doc.items.map((it: any) => {
          delete it.unitCost;
          delete it.totalCost;
          return it;
        });
      }
      return doc;
    });

    res.json({ success: true, dispatches: sanitizedDispatches });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getInventoryByCollege = async (req: Request, res: Response): Promise<void> => {
  try {
    const isCollegeMember = req.user?.role === 'COLLEGE_MEMBER';
    let targetCollege = req.query.college as string || req.params.college;

    // Strict security enforcement
    if (isCollegeMember) {
      if (!req.user?.college) {
        res.status(403).json({ success: false, message: 'No college assigned to your account.' });
        return;
      }
      if (targetCollege && targetCollege.trim().toLowerCase() !== req.user.college.trim().toLowerCase()) {
        res.status(403).json({
          success: false,
          message: 'Access Denied: You cannot access other colleges’ inventory.',
        });
        return;
      }
      targetCollege = req.user.college;
    }

    if (!targetCollege) {
      res.status(400).json({ success: false, message: 'College name is required.' });
      return;
    }

    const items = await getCollegeInventory(targetCollege);
    res.json({
      success: true,
      college: targetCollege,
      items,
      inventory: items,
      totalProducts: items.length,
      totalUnits: items.reduce((sum, it) => sum + it.currentStock, 0),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getColleges = async (req: Request, res: Response): Promise<void> => {
  try {
    const isCollegeMember = req.user?.role === 'COLLEGE_MEMBER';
    if (isCollegeMember) {
      res.json({ success: true, colleges: req.user?.college ? [req.user.college] : [] });
      return;
    }

    const colleges = await getAllCollegesList();
    res.json({ success: true, colleges });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
