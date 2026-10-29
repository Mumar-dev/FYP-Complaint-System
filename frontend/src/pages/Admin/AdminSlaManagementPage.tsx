import React, { useState } from 'react';
import Card from '@components/Common/Card';
import Button from '@components/Common/Button';
import {
  Sliders,
  Plus,
  Edit2,
  Trash2,
  X,
  Loader2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import {
  useGetSlaPoliciesQuery,
  useCreateSlaPolicyMutation,
  useUpdateSlaPolicyMutation,
  useDeleteSlaPolicyMutation
} from '@/features/sla/sla.api';
import { useGetDepartmentsQuery } from '@/features/department/department.api';
import toast from 'react-hot-toast';

const AdminSlaManagementPage: React.FC = () => {
  const { data: policiesData, isLoading: loadingPolicies, refetch } = useGetSlaPoliciesQuery();
  const { data: departmentsData } = useGetDepartmentsQuery();
  const [createPolicy, { isLoading: creating }] = useCreateSlaPolicyMutation();
  const [updatePolicy, { isLoading: updating }] = useUpdateSlaPolicyMutation();
  const [deletePolicy, { isLoading: deleting }] = useDeleteSlaPolicyMutation();

  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [showModal, setShowModal] = useState(false);
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('high');
  const [targetHours, setTargetHours] = useState(12);
  const [warningThresholdPercent, setWarningThresholdPercent] = useState(80);

  // Delete Confirmation Modal
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; policy: any | null }>({
    open: false,
    policy: null,
  });

  // Extract department names for categories dropdown
  const departments = departmentsData?.data || [];
  const defaultCategories = ['General', 'Maintenance', 'Security', 'Housekeeping', 'Landscaping', 'Electrical & Power'];
  const departmentNames = departments.map((d: any) => d.name);
  const categoryOptions = Array.from(new Set([...departmentNames, ...defaultCategories]));

  const openCreateModal = () => {
    setModalMode('create');
    setEditingPolicyId(null);
    setName('');
    setCategory(categoryOptions[0] || 'General');
    setPriority('high');
    setTargetHours(12);
    setWarningThresholdPercent(80);
    setShowModal(true);
  };

  const openEditModal = (p: any) => {
    setModalMode('edit');
    setEditingPolicyId(p._id);
    setName(p.name);
    setCategory(p.category);
    setPriority((p.priority || 'medium').toLowerCase() as any);
    setTargetHours(p.targetHours);
    setWarningThresholdPercent(p.warningThresholdPercent || 80);
    setShowModal(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !category) {
      toast.error('Policy name and category are required');
      return;
    }

    try {
      if (modalMode === 'create') {
        await createPolicy({
          name: name.trim(),
          category: category.trim(),
          priority: priority.toLowerCase(),
          targetHours: Number(targetHours),
          warningThresholdPercent: Number(warningThresholdPercent),
        }).unwrap();
        toast.success('SLA policy created successfully');
      } else if (editingPolicyId) {
        await updatePolicy({
          id: editingPolicyId,
          name: name.trim(),
          category: category.trim(),
          priority: priority.toLowerCase(),
          targetHours: Number(targetHours),
          warningThresholdPercent: Number(warningThresholdPercent),
        }).unwrap();
        toast.success('SLA policy updated successfully');
      }
      setShowModal(false);
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || 'Failed to save SLA policy');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal.policy) return;
    try {
      await deletePolicy(deleteModal.policy._id).unwrap();
      toast.success(`Policy "${deleteModal.policy.name}" deleted successfully`);
      setDeleteModal({ open: false, policy: null });
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || 'Failed to delete policy');
    }
  };

  const policies = policiesData?.data || [];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Service Level Agreement (SLA) Policies</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              {policies.length} {policies.length === 1 ? 'Policy' : 'Policies'} Active
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Configure target resolution deadlines, priority tiers, and proactive warning thresholds by category.
          </p>
        </div>
        <Button variant="primary" onClick={openCreateModal} icon={<Plus className="w-4 h-4" />}>
          New SLA Policy
        </Button>
      </div>

      {/* Main Body: Loading vs Empty vs Grid */}
      {loadingPolicies ? (
        <Card className="p-16 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
          <p className="text-xs font-medium text-slate-500">Loading configured SLA policies...</p>
        </Card>
      ) : policies.length === 0 ? (
        <Card className="p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-2xs">
            <Sliders className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-gray-900">No SLA Policies Configured</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto mt-1 mb-5">
            Define resolution turnaround windows and warning threshold percentages so new complaints automatically bind to enforceable SLAs.
          </p>
          <Button variant="primary" onClick={openCreateModal} icon={<Plus className="w-4 h-4" />}>
            Create First SLA Policy
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {policies.map((p: any) => {
            const prioLower = (p.priority || 'medium').toLowerCase();
            const badgeClass =
              prioLower === 'critical'
                ? 'bg-red-100 text-red-800 border-red-200'
                : prioLower === 'high'
                ? 'bg-amber-100 text-amber-800 border-amber-200'
                : prioLower === 'medium'
                ? 'bg-blue-100 text-blue-800 border-blue-200'
                : 'bg-slate-100 text-slate-800 border-slate-200';

            return (
              <Card key={p._id} className="p-5 border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{p.category}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${badgeClass}`}>
                      {p.priority}
                    </span>
                  </div>

                  <h4 className="font-bold text-gray-900 text-base mt-2.5 leading-snug">{p.name}</h4>

                  <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2 text-xs text-gray-700">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        Target Resolution:
                      </span>
                      <span className="font-bold text-slate-900">{p.targetHours} hours</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        Warning Trigger:
                      </span>
                      <span className="font-bold text-amber-900">{p.warningThresholdPercent || 80}% elapsed</span>
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => openEditModal(p)}
                    className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                    title="Edit policy"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteModal({ open: true, policy: p })}
                    className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                    title="Delete policy"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 border border-slate-200">
            <div className="flex items-start justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  {modalMode === 'create' ? 'Configure New SLA Policy' : 'Edit SLA Policy'}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Set target resolution timeline and automated warning triggers.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Policy Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Critical High-Voltage Failure Policy"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-blue-500"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white focus:outline-none focus:border-blue-500"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                >
                  {categoryOptions.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    Priority <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white focus:outline-none focus:border-blue-500 capitalize"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    Target Resolution <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs pr-12 focus:outline-none focus:border-blue-500"
                      value={targetHours}
                      onChange={(e) => setTargetHours(Number(e.target.value))}
                      required
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">
                      hrs
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-gray-700">
                    Warning Threshold Percentage
                  </label>
                  <span className="text-xs font-bold text-amber-700">{warningThresholdPercent}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="95"
                  step="5"
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                  value={warningThresholdPercent}
                  onChange={(e) => setWarningThresholdPercent(Number(e.target.value))}
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Sends an approaching-breach alert when {warningThresholdPercent}% of the target window has elapsed.
                </p>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <Button variant="secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" isLoading={creating || updating}>
                  {modalMode === 'create' ? 'Save Policy' : 'Update Policy'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteModal.open && deleteModal.policy && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl space-y-4 border border-slate-200">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center border border-red-100">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Delete SLA Policy?</h3>
              <p className="text-xs text-gray-500 mt-1">
                Are you sure you want to delete <span className="font-semibold text-gray-800">"{deleteModal.policy.name}"</span>?
                New complaints in this category will fall back to default department hours.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModal({ open: false, policy: null })}
                disabled={deleting}
                className="h-8 px-3 rounded-lg border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="h-8 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Delete Policy</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSlaManagementPage;
