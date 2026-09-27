# Society Complaint Management System (CMS) - Backend Architecture & API Specification

Enterprise-level RESTful API backend built with Node.js, Express.js, TypeScript, and MongoDB for comprehensive society complaint handling, departmental routing, multi-staff assignment, SLA/ETA tracking, mandatory evidence verification, and an integrated **Employee & Human Resource Management Module**.

---

## 1. System Roles & Permissions Matrix

| Role | Responsibilities & Capabilities |
| :--- | :--- |
| **Resident** | Register, login, edit home address & profile, submit complaints (3 location modes: home, GPS, manual), view only their own complaints, track history, submit ratings & feedback on resolved/closed complaints, request reopening with mandatory reason. |
| **Staff** | View assigned complaints, update progress, start work (`in_progress`), submit completion notes with mandatory evidence photos (`under_verification`), recommend ETA changes, check-in/out, submit leave requests, view own attendance/leave balances, view personal performance evaluations, submit appeals, request promotions. Cannot close complaints independently. |
| **Supervisor** | Monitor departmental complaints, assign/reassign primary & supporting staff, verify completion evidence (Approve & Close or Reject back to `in_progress`), grant photo exceptions, approve significant ETA changes, handle reopening requests, monitor departmental employee attendance, review leave requests, evaluate staff performance, recommend promotions, report disciplinary issues. |
| **Department Head** | Manage department operations & staff, authorize cross-department transfers with mandatory reason, monitor departmental workload, view departmental analytics, review staff performance & promotions. |
| **Admin** | Manage users, residents, employees, departments, view system-wide complaints & reports, configure shifts and leave policies, manage disciplinary actions & suspensions, configure SLA policies per category and priority. |
| **Super Admin** | Full system-level access, manage administrators, configure system settings, view comprehensive audit logs with multi-parameter filtering, manage privileged HR actions. |

---

## 2. Integrated Employee & HR Management Modules

### A. Employee Identity & Profile Management (`/api/employees`)
- **Single Source of Truth:** Extends the existing CMS `User` model. No duplicate login systems or accounts.
- **Auto-generated ID:** System-generated unique `employeeId` format: `EMP-YYYY-XXXX`.
- **Employment Statuses:** `ACTIVE`, `INACTIVE`, `ON_LEAVE`, `SUSPENDED`, `RESIGNED`, `TERMINATED`.
- **Employment History:** Immutable tracking in `EmploymentHistory` capturing previous and new values for designations, departments, statuses, reasons, and actors.
- **Secure Documents:** Encrypted Cloudinary storage with confidentiality controls for CNICs, appointment letters, and agreements (`EmployeeDocument`).

### B. Shift & Attendance Management (`/api/shifts`, `/api/attendance`)
- **Configurable Shifts:** Start/end times, break durations, grace periods (e.g. 15 min), working days, overnight shifts, overtime thresholds.
- **Check-in / Check-out:** Enforces one check-in per day, verifies active employment status, calculates exact working duration and overtime, flags late arrival and early departure.
- **Attendance Corrections:** Employees submit correction requests with mandatory justification. Supervisors/Admins approve/reject. **Strict self-approval prevention enforced.**
- **Leave Reconciliation:** Approved leaves automatically generate `on_leave` attendance records, preventing leaves from registering as unauthorized absences.

### C. Leave Management & Balance Ledger (`/api/leaves`)
- **Configurable Leave Types:** Annual, Sick, Casual, Emergency, Unpaid (`LeaveType`).
- **Balance Ledger:** Tracks allocated, used, pending, and remaining days per employee per year (`LeaveBalance`).
- **Workflow & Safeguards:**
  - Prevents overlapping pending or approved leave dates.
  - Balances reserved upon request and finalized or returned upon review.
  - Strict self-approval prevention. Rejection requires a mandatory reason.
  - Syncs employee `employmentStatus` to `ON_LEAVE` during approved leave periods.

### D. Multi-Factor Evidence-Based Performance Engine (`/api/performance`)
- **Weighted Scoring Engine:** Evaluates performance on 6 dimensions:
  1. Resolution Quality (25%)
  2. Timeliness & SLA Adherence (20%)
  3. Resident Satisfaction Rating (20%)
  4. Attendance & Punctuality (15%)
  5. Supervisor Written Evaluation (10%)
  6. Workload & Complexity (10%)
- **Data Sufficiency Safeguard:** Requires minimum 3 complaints evaluated; flags insufficient data to prevent misleading scores on small sample sizes.
- **Performance Categories:** `TOP_PERFORMER` (≥90), `HIGH_PERFORMANCE` (≥75), `MODERATE_PERFORMANCE` (≥60), `NEEDS_IMPROVEMENT` (<60).
- **Formal Appeals:** Employees can submit concerns and appeals. Management reviews and can uphold, modify, or reject scores.

### E. Promotions & Career Growth (`/api/promotions`)
- **Self or Supervisor Nomination:** Employees self-apply or supervisors recommend promotions with written justifications.
- **Approval Workflow:** `SUBMITTED → UNDER_REVIEW → APPROVED / REJECTED`.
- **Immediate Application:** Upon approval, automatically updates employee `designation` and generates an immutable record in `EmploymentHistory`. Self-approval strictly forbidden.

### F. Department Transfers & Complaint Handover (`/api/employee-transfers`)
- Department transfer requests reviewed by authorized management.
- **Assignment Handover:** Upon transfer approval, active complaints assigned to the employee are automatically identified and re-queued to `pending_assignment`, deactivating previous active assignments.
- Revokes previous departmental permissions and updates `departmentId`.

### G. Disciplinary Management & Suspensions (`/api/disciplinary`)
- **Case Tracking:** Track cases (`caseNumber: DISC-YYYY-XXXX`) with categories, evidence attachments, status, and management decisions.
- **Suspension Enforcement:**
  - Updates `employmentStatus = 'SUSPENDED'` and blocks check-ins/system actions.
  - Automatically identifies and reassigns open active complaints to prevent delays.
  - Formal reinstatement workflow restores `ACTIVE` status.

### H. Centralized Meaningful Audit Logging (`AuditService`)
- Reuses the existing `AuditService` and `AuditLog` model.
- Every important action across all modules records:
  - **Who made the change** (`userId`, `userRole`)
  - **What record was changed** (`entityType`, `entityId`)
  - **Previous value** (`details.previousValue`)
  - **New value** (`details.newValue`)
  - **Reason** (`details.reason`)
  - **Timestamp** (`createdAt`)
- Sensitive credentials, password hashes, and tokens are never logged. Audit records are protected against unauthorized modification or deletion.

---

## 3. Automated Test Verification Results

All automated test suites pass cleanly via Jest:
```text
PASS src/__tests__/attendance.test.ts
  Employee Attendance & Shift Management Tests
    √ should detect late check-in when check-in is after shift start + grace period
    √ should calculate working duration and overtime correctly on check-out
    √ should enforce self-approval prevention on attendance corrections

PASS src/__tests__/performance.test.ts
  Performance Evaluation Multi-Factor Engine Tests
    √ should flag insufficient data state when sample size is below threshold (< 3)
    √ should compute weighted score across all 6 evaluation dimensions
    √ should prevent employee from reviewing their own performance appeal

PASS src/__tests__/leave.test.ts
  Leave Management & Balance Validation Tests
    √ should prevent overlapping leave requests
    √ should enforce self-approval restriction on leave requests
    √ should reject leave request if requested days exceed remaining balance

PASS src/__tests__/slaEta.test.ts
  SLA vs ETA Independent Tracking Tests
    √ should calculate SLA deadline strictly from configured SLAPolicy
    √ should flag significant ETA changes (> 12h) as pending_approval for staff
    √ should allow supervisors to auto-approve ETA changes

PASS src/__tests__/workflow.test.ts
  Centralized Complaint Workflow Service Tests
    Status Transition Matrix
      √ should permit SUBMITTED -> ASSIGNED
      √ should permit ASSIGNED -> IN_PROGRESS
      √ should permit IN_PROGRESS -> UNDER_VERIFICATION
      √ should permit UNDER_VERIFICATION -> CLOSED (Approval)
      √ should permit UNDER_VERIFICATION -> IN_PROGRESS (Rejection)
      √ should permit CLOSED -> REOPENED
      √ should REJECT arbitrary transition SUBMITTED -> CLOSED
      √ should REJECT invalid transition CLOSED -> IN_PROGRESS directly
    Role-Based Transition Permissions
      √ Staff CANNOT independently close a complaint from UNDER_VERIFICATION
      √ Supervisor CAN approve evidence and close a complaint from UNDER_VERIFICATION
      √ Supervisor CAN reject evidence returning UNDER_VERIFICATION to IN_PROGRESS
      √ Assigned staff CAN start work moving ASSIGNED to IN_PROGRESS
      √ Resident owner CAN request reopening on CLOSED complaint
      √ Unauthorized resident CANNOT reopen another resident complaint

PASS src/__tests__/notification.test.ts
  Notification Service & Deduplication Tests
    √ should prevent duplicate notifications when idempotencyKey matches existing record
    √ should deliver notification when idempotencyKey is new

Test Suites: 6 passed, 6 total
Tests:       28 passed, 28 total
Snapshots:   0 total
Time:        19.914 s
Ran all test suites.
```

TypeScript check (`npx tsc --noEmit`) passes with **0 errors**.

---

## 4. Execution & Setup Commands

```powershell
cd Backend

# Verify TypeScript compilation
npx tsc --noEmit

# Run full automated test suite
npm test

# Run backend development server
npm run dev
```
