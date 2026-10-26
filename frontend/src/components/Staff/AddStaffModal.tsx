import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Key, Eye, EyeOff } from 'lucide-react';
import { useCreateStaffMutation, useGetDepartmentsQuery } from '@/features/admin/admin.api';
import { showSuccess, showError } from '@/utils/toast';

interface AddStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDepartmentId?: string;
  onStaffCreated?: () => void;
}

export const AddStaffModal: React.FC<AddStaffModalProps> = ({
  isOpen,
  onClose,
  defaultDepartmentId,
  onStaffCreated
}) => {
  const [createStaff, { isLoading: isCreating }] = useCreateStaffMutation();
  const { data: departmentsData } = useGetDepartmentsQuery({ approvedOnly: true, activeOnly: true });

  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    cnic: '',
    password: '',
    departmentId: defaultDepartmentId || '',
    post: '',
    rank: 'junior'
  });

  if (!isOpen) return null;

  // Defensively filter to only include approved and active departments
  const departments = (departmentsData?.data || []).filter(
    (d: any) => (d.approvalStatus === 'approved' || !d.approvalStatus) && d.isActive === true
  );
  const selectedDeptObj = departments.find((d: any) => d._id === (formData.departmentId || defaultDepartmentId));
  const departmentPositions: string[] = Array.isArray(selectedDeptObj?.jobPositions)
    ? selectedDeptObj.jobPositions
    : Array.isArray(selectedDeptObj?.positions)
      ? selectedDeptObj.positions
      : [];

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
    let pass = '';
    for (let i = 0; i < 10; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, password: pass }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.email.trim() || !formData.password.trim()) {
      showError('Please fill in all required fields.');
      return;
    }

    try {
      const res = await createStaff({
        ...formData,
        departmentId: formData.departmentId || null
      }).unwrap();

      if (res?.data?.emailSent) {
        showSuccess('Staff created & credentials emailed.');
      } else {
        showSuccess('Staff created, but email failed.');
      }
      onClose();
      if (onStaffCreated) onStaffCreated();
    } catch (err: any) {
      showError(err.data?.message || 'Failed to create staff account.');
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in duration-150">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        {/* Clean Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Add New Staff Member</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Create an official staff account and send onboarding login details via email.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isCreating}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Balanced 2-Column Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="p-6 space-y-4">
            {/* Row 1: Full Name * & Work Email * */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1.5 block">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="e.g. Tariq Mehmood"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 mb-1.5 block">
                  Work Email <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g. staff@community.com"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Row 2: Password * & Phone Number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-700 block">
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={generatePassword}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 focus:outline-none cursor-pointer"
                  >
                    <Key className="w-3 h-3" />
                    <span>Generate</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Set initial password"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-3 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 mb-1.5 block">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="e.g. 03001234567"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Row 3: Department (First) & Rank */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1.5 block">
                  Department
                </label>
                <select
                  value={formData.departmentId}
                  onChange={(e) => setFormData(prev => ({ ...prev, departmentId: e.target.value, post: '' }))}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 focus:outline-none transition-all cursor-pointer"
                >
                  <option value="">Unassigned (No Department)</option>
                  {departments.map((d: any) => (
                    <option key={d._id} value={d._id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 mb-1.5 block">
                  Rank
                </label>
                <select
                  value={formData.rank}
                  disabled={!formData.departmentId}
                  onChange={(e) => setFormData({ ...formData, rank: e.target.value })}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 focus:outline-none transition-all cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                >
                  {!formData.departmentId ? (
                    <option value="">Select a department first...</option>
                  ) : (
                    <>
                      <option value="junior">Junior</option>
                      <option value="senior">Senior</option>
                      <option value="lead">Team Lead</option>
                      <option value="supervisor">Supervisor</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            {/* Row 4: Position / Job Title (Dependent strictly on Department) & CNIC */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1.5 block">
                  Position / Job Title
                </label>
                <select
                  value={formData.post}
                  disabled={!formData.departmentId || departmentPositions.length === 0}
                  onChange={(e) => setFormData({ ...formData, post: e.target.value })}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 focus:outline-none transition-all cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                >
                  {!formData.departmentId ? (
                    <option value="">Select a department first...</option>
                  ) : departmentPositions.length === 0 ? (
                    <option value="">No job positions configured for this department</option>
                  ) : (
                    <>
                      <option value="">Select position / job title...</option>
                      {departmentPositions.map((pos: string) => (
                        <option key={pos} value={pos}>
                          {pos}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 mb-1.5 block">
                  CNIC (Optional)
                </label>
                <input
                  type="text"
                  value={formData.cnic}
                  onChange={(e) => setFormData({ ...formData, cnic: e.target.value })}
                  placeholder="13-digit CNIC"
                  maxLength={15}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Email Notice Note */}
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200/80 px-3.5 py-2.5 text-xs text-slate-600">
              <p>
                Note: Login credentials will be automatically sent to{' '}
                {formData.email.trim() ? (
                  <span className="font-semibold text-slate-900">{formData.email.trim()}</span>
                ) : (
                  'the entered work email'
                )}{' '}
                once you create this staff account.
              </p>
            </div>
          </div>

          {/* Clean Footer */}
          <div className="px-6 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isCreating}
              className="h-9 px-4 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors focus:outline-none cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-xs disabled:opacity-50 whitespace-nowrap flex items-center gap-2 focus:outline-none transition-colors cursor-pointer"
            >
              {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Create Staff</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
