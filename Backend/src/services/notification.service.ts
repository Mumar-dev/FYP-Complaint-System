import { Types } from 'mongoose';
import { Notification } from '../models/notification.model';
import { INotification, NotificationType } from '../interfaces/notification.interface';
import { emitNotificationToUser, emitAnalyticsUpdate } from './socket.service';

export interface SendNotificationParams {
  userId: Types.ObjectId | string;
  type: NotificationType;
  title?: string;
  message: string;
  complaintId?: Types.ObjectId | string;
  idempotencyKey?: string;
}

export class NotificationService {
  /**
   * Sends persistent in-app notification with idempotency check to avoid duplicate alerts,
   * and emits real-time Socket.IO notification to the user's room.
   */
  static async send(params: SendNotificationParams): Promise<INotification | null> {
    try {
      if (params.idempotencyKey) {
        const existing = await Notification.findOne({ idempotencyKey: params.idempotencyKey });
        if (existing) {
          return existing;
        }
      }

      const notif = await Notification.create({
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        complaintId: params.complaintId,
        idempotencyKey: params.idempotencyKey,
        deliveryStatus: 'delivered',
        read: false
      });

      // Real-time socket emission
      try {
        emitNotificationToUser(params.userId.toString(), notif);
        emitAnalyticsUpdate('notification_created', { type: params.type, complaintId: params.complaintId });
      } catch (err) {
        console.error('[NotificationService] Socket emission failed:', err);
      }

      return notif;
    } catch (error: any) {
      // Catch unique index conflict on idempotencyKey gracefully
      if (error.code === 11000) {
        return await Notification.findOne({ idempotencyKey: params.idempotencyKey });
      }
      console.error('[NotificationService] Notification delivery failed:', error);
      return null;
    }
  }

  /**
   * Helper to send notification to all Department Heads of a specific department
   */
  static async notifyDepartmentHeads(departmentId: Types.ObjectId | string, params: {
    type: NotificationType;
    message: string;
    complaintId?: Types.ObjectId | string;
    title?: string;
  }): Promise<void> {
    try {
      if (!departmentId) return;
      const { User } = require('../models/user.model');
      const deptHeads = await User.find({
        departmentId,
        role: 'department_head'
      }).select('_id');

      for (const head of deptHeads) {
        await NotificationService.send({
          userId: head._id,
          type: params.type,
          title: params.title,
          message: params.message,
          complaintId: params.complaintId
        });
      }
    } catch (err) {
      console.error('[NotificationService] Error notifying department heads:', err);
    }
  }

  /**
   * Helper to send notification to all Admins and Superadmins
   */
  static async notifyAdmins(params: {
    type: NotificationType;
    message: string;
    title?: string;
    complaintId?: Types.ObjectId | string;
    idempotencyKey?: string;
  }): Promise<void> {
    try {
      const { User } = require('../models/user.model');
      const admins = await User.find({
        role: { $in: ['admin', 'superadmin'] },
        accountStatus: 'active'
      }).select('_id');

      for (const admin of admins) {
        await NotificationService.send({
          userId: admin._id,
          type: params.type,
          title: params.title,
          message: params.message,
          complaintId: params.complaintId,
          idempotencyKey: params.idempotencyKey ? `${params.idempotencyKey}-${admin._id}` : undefined
        });
      }
    } catch (err) {
      console.error('[NotificationService] Error notifying admins:', err);
    }
  }

  /**
   * Retries failed notifications.
   */
  static async retryFailedNotifications(maxRetries = 3): Promise<number> {
    const failedList = await Notification.find({
      deliveryStatus: 'failed',
      retryCount: { $lt: maxRetries }
    });

    let succeeded = 0;
    for (const item of failedList) {
      try {
        // Attempt simulated delivery or channel fanout
        item.retryCount += 1;
        item.deliveryStatus = 'delivered';
        await item.save();
        succeeded += 1;
      } catch (err: any) {
        item.errorLog = err.message;
        await item.save();
      }
    }
    return succeeded;
  }
}
