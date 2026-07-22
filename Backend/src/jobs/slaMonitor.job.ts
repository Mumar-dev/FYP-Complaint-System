import { Complaint } from '../models/complaint.model';
import { Department } from '../models/department.model';
import { SLAPolicy } from '../models/slaPolicy.model';
import { NotificationService } from '../services/notification.service';
import { AuditService } from '../services/audit.service';

export const startSlaMonitorJob = () => {
  // Run periodic monitoring every 3 minutes
  const INTERVAL_MS = 3 * 60 * 1000;

  setInterval(async () => {
    try {
      const now = new Date();

      // 1. Detect Approaching SLA Warning Thresholds (e.g. 80% elapsed time)
      const activeComplaints = await Complaint.find({
        status: { $nin: ['resolved', 'closed', 'cancelled'] },
        slaBreached: false,
        slaWarningSent: { $ne: true },
        slaDeadline: { $gt: now }
      });

      for (const complaint of activeComplaints) {
        // Calculate policy or department target hours and warning threshold
        const createdAtTime = new Date((complaint as any).createdAt || now).getTime();
        const deadlineTime = new Date(complaint.slaDeadline).getTime();
        const totalDurationMs = deadlineTime - createdAtTime;

        if (totalDurationMs <= 0) continue;

        // Lookup configured policy warning threshold percent
        let thresholdPercent = 80;
        if (complaint.category && complaint.priority) {
          const policy = await SLAPolicy.findOne({
            category: complaint.category,
            priority: complaint.priority.toLowerCase() as any,
            isActive: true
          });
          if (policy?.warningThresholdPercent) {
            thresholdPercent = policy.warningThresholdPercent;
          }
        }

        const elapsedMs = now.getTime() - createdAtTime;
        const elapsedPercent = (elapsedMs / totalDurationMs) * 100;

        // If elapsed time has reached or passed threshold %, send one-time warning
        if (elapsedPercent >= thresholdPercent) {
          complaint.slaWarningSent = true;
          await complaint.save();

          const department = await Department.findById(complaint.departmentId);
          const remainingMinutes = Math.max(0, Math.round((deadlineTime - now.getTime()) / (1000 * 60)));
          const remainingHours = (remainingMinutes / 60).toFixed(1);

          // Notify Department Head
          if (department && department.headOfDepartment) {
            await NotificationService.send({
              userId: department.headOfDepartment,
              type: 'sla_breach',
              title: `SLA Warning: ${thresholdPercent}% Time Elapsed`,
              message: `Complaint #${complaint.complaintId} (${complaint.title}) has reached ${Math.round(elapsedPercent)}% of its SLA timeline. Approx ${remainingHours}h remaining before breach.`,
              complaintId: complaint._id,
              idempotencyKey: `sla_warn_dh_${complaint._id}`
            });
          }

          // Notify Assigned Staff (if assigned)
          if (complaint.primaryStaffId) {
            await NotificationService.send({
              userId: complaint.primaryStaffId,
              type: 'sla_breach',
              title: `Action Required: SLA Approaching Deadline`,
              message: `Complaint #${complaint.complaintId} (${complaint.title}) is at ${Math.round(elapsedPercent)}% of its target SLA resolution time (~${remainingHours}h left).`,
              complaintId: complaint._id,
              idempotencyKey: `sla_warn_staff_${complaint._id}`
            });
          }

          // Audit warning notification
          await AuditService.log({
            userId: complaint.residentId,
            userRole: 'system',
            action: 'SLA_WARNING_THRESHOLD_REACHED',
            entityType: 'SLA',
            entityId: complaint._id,
            details: {
              thresholdPercent,
              elapsedPercent: Math.round(elapsedPercent),
              slaDeadline: complaint.slaDeadline
            }
          });
        }
      }

      // 2. Detect SLA Breaches
      const breachedComplaints = await Complaint.find({
        status: { $nin: ['resolved', 'closed', 'cancelled'] },
        slaDeadline: { $lt: now },
        slaBreached: false
      });

      for (const complaint of breachedComplaints) {
        complaint.slaBreached = true;
        complaint.slaStatus = 'extended';
        await complaint.save();

        const department = await Department.findById(complaint.departmentId);
        
        // Notify Department Head & Supervisor
        if (department && department.headOfDepartment) {
          await NotificationService.send({
            userId: department.headOfDepartment,
            type: 'sla_breach',
            title: 'CRITICAL: SLA Breached',
            message: `Complaint #${complaint.complaintId} (${complaint.title}) has breached its official SLA deadline!`,
            complaintId: complaint._id,
            idempotencyKey: `sla_breach_${complaint._id}`
          });
        }

        // Also notify all Admins of SLA Breach
        await NotificationService.notifyAdmins({
          type: 'sla_breach',
          title: 'CRITICAL: SLA Breached',
          message: `**SLA Breached:** Complaint #${complaint.complaintId} (${complaint.title}) in ${department?.name || 'Department'} missed its SLA deadline.`,
          complaintId: complaint._id,
          idempotencyKey: `sla_breach_admin_${complaint._id}`
        });

        // Audit SLA Breach
        await AuditService.log({
          userId: complaint.residentId,
          userRole: 'system',
          action: 'SLA_BREACH_DETECTED',
          entityType: 'SLA',
          entityId: complaint._id,
          details: { slaDeadline: complaint.slaDeadline, breachedAt: now }
        });
      }

      // 3. Detect Missed ETAs (separate from SLA breaches)
      const missedEtaComplaints = await Complaint.find({
        status: { $nin: ['resolved', 'closed', 'cancelled'] },
        currentEta: { $lt: now },
        slaBreached: false // Missed ETA while SLA is still intact
      });

      for (const complaint of missedEtaComplaints) {
        if (complaint.primaryStaffId) {
          await NotificationService.send({
            userId: complaint.primaryStaffId,
            type: 'eta_missed',
            title: 'ETA Target Overdue',
            message: `The estimated completion time for complaint #${complaint.complaintId} has passed. Please update progress or propose a revised ETA.`,
            complaintId: complaint._id,
            idempotencyKey: `eta_missed_${complaint._id}_${complaint.currentEta?.getTime()}`
          });
        }
      }

      // 4. Retry failed notifications
      await NotificationService.retryFailedNotifications();
    } catch (error) {
      console.error('[SLA / ETA Monitor Job Error]:', error);
    }
  }, INTERVAL_MS);
};
