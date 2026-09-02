import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, CheckCircle, Eye, EyeOff, Building, HelpCircle, Home, Check, Hourglass, LogIn, BadgeCheck } from 'lucide-react';
import { Button, Card, InputField } from '@components/Common';
import { ROUTES } from '@constants/index';
import { PageMeta } from '@components/Common/PageMeta';
import { useRegisterMutation } from '@/features/auth/auth.api';
import { showSuccess, showError } from '@/utils/toast';

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    block: '',
    houseNumber: '',
    street: '',
    phoneNumber: '',
    cnic: '',
    document: null as File | null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!formData.email.includes('@')) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password.trim()) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!formData.block.trim()) {
      newErrors.block = 'Block is required';
    }

    if (!formData.houseNumber.trim()) {
      newErrors.houseNumber = 'House number is required';
    }

    if (!formData.street.trim()) {
      newErrors.street = 'Street is required';
    }

    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required';
    }

    if (!formData.cnic.trim()) {
      newErrors.cnic = 'CNIC is required';
    } else if (formData.cnic.length < 13) {
      newErrors.cnic = 'CNIC must be at least 13 characters';
    }

    if (!formData.document) {
      newErrors.document = 'Proof document is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData({ ...formData, document: file });
      if (errors.document) {
        setErrors({ ...errors, document: '' });
      }
    }
  };

  const [registerMutation, { isLoading: isRegistering }] = useRegisterMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const formPayload = new FormData();
        formPayload.append('email', formData.email);
        formPayload.append('password', formData.password);
        formPayload.append('role', 'resident');
        // Profile fields
        formPayload.append('profile[fullName]', formData.fullName);
        formPayload.append('profile[phone]', formData.phoneNumber);
        formPayload.append('profile[cnic]', formData.cnic);
        // Address fields
        formPayload.append('profile[address][block]', formData.block);
        formPayload.append('profile[address][houseNumber]', formData.houseNumber);
        formPayload.append('profile[address][street]', formData.street);
        // Proof document
        if (formData.document) {
          formPayload.append('document', formData.document);
        }

        await registerMutation(formPayload).unwrap();
      showSuccess('Account created successfully. Wait for approval');
      setSuccess(true);
    } catch (error: any) {
      console.error('Registration failed:', error);
      showError(error?.data?.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      <PageMeta title="Create Your Account | Resident Portal" description="Register a new resident account" />
      
      {/* Top Navbar */}
      <header className="w-full bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-6 py-3.5 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
            <Building className="w-5 h-5" />
          </div>
          <span className="text-lg font-bold text-slate-900 tracking-tight">Resident Portal</span>
        </div>
        
        {/* Redesigned Top-Right Login Area */}
        <div className="flex items-center gap-3">
          <span className="text-xs sm:text-sm text-slate-500 hidden sm:inline">
            Already have an account?
          </span>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => navigate(ROUTES.LOGIN)}
            className="!py-1.5 !px-4 text-xs sm:text-sm font-semibold rounded-lg shadow-sm shadow-blue-500/20"
          >
            Log In
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">

      {/* Register Card */}
      <div className="w-full max-w-3xl">
        <Card className="p-7 sm:p-10 shadow-xl shadow-slate-200/50 border border-slate-200/80 bg-white rounded-2xl">
          {/* Registration Form Wrapper */}
          {!success ? (
            <div>
              {/* Header */}
              <div className="mb-8 border-b border-slate-100 pb-5">
                <div className="inline-flex items-center px-2.5 py-0.5 bg-blue-50 text-blue-600 text-xs font-semibold rounded-full mb-2">
                  New Resident
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Create Your Account
                </h1>
                <p className="text-slate-500 text-sm mt-1.5 leading-relaxed">
                  Enter your personal and home details to get started.
                </p>
              </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* SECTION 1: Personal Details */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Personal Details
                  </h2>
                  <div className="flex-1 h-px bg-slate-100"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                  {/* Full Name Field */}
                  <div>
                    <label htmlFor="fullName" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <InputField
                      id="fullName"
                      type="text"
                      placeholder="e.g., Ali Ahmed"
                      value={formData.fullName}
                      onChange={(e) => {
                        setFormData({ ...formData, fullName: e.target.value });
                        if (errors.fullName) {
                          setErrors({ ...errors, fullName: '' });
                        }
                      }}
                      error={errors.fullName}
                      className="h-11 text-sm border-slate-300 focus:border-blue-500 focus:ring-blue-100"
                      required
                    />
                  </div>

                  {/* CNIC Field */}
                  <div>
                    <label htmlFor="cnic" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      CNIC Number <span className="text-red-500">*</span>
                    </label>
                    <InputField
                      id="cnic"
                      type="text"
                      placeholder="13 digits without dashes (e.g., 3520212345671)"
                      value={formData.cnic}
                      onChange={(e) => {
                        setFormData({ ...formData, cnic: e.target.value });
                        if (errors.cnic) {
                          setErrors({ ...errors, cnic: '' });
                        }
                      }}
                      error={errors.cnic}
                      className="h-11 text-sm border-slate-300 focus:border-blue-500 focus:ring-blue-100"
                      required
                    />
                  </div>

                  {/* Email Field */}
                  <div>
                    <label htmlFor="email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <InputField
                      id="email"
                      type="email"
                      placeholder="name@example.com"
                      value={formData.email}
                      onChange={(e) => {
                        setFormData({ ...formData, email: e.target.value });
                        if (errors.email) {
                          setErrors({ ...errors, email: '' });
                        }
                      }}
                      error={errors.email}
                      className="h-11 text-sm border-slate-300 focus:border-blue-500 focus:ring-blue-100"
                      required
                    />
                  </div>

                  {/* Phone Number Field */}
                  <div>
                    <label htmlFor="phoneNumber" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Mobile Number <span className="text-red-500">*</span>
                    </label>
                    <InputField
                      id="phoneNumber"
                      type="tel"
                      placeholder="e.g., 0300-1234567"
                      value={formData.phoneNumber}
                      onChange={(e) => {
                        setFormData({ ...formData, phoneNumber: e.target.value });
                        if (errors.phoneNumber) {
                          setErrors({ ...errors, phoneNumber: '' });
                        }
                      }}
                      error={errors.phoneNumber}
                      className="h-11 text-sm border-slate-300 focus:border-blue-500 focus:ring-blue-100"
                      required
                    />
                  </div>

                  {/* Password Field */}
                  <div className="md:col-span-2">
                    <label htmlFor="password" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Create Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Minimum 6 characters"
                        value={formData.password}
                        onChange={(e) => {
                          setFormData({ ...formData, password: e.target.value });
                          if (errors.password) {
                            setErrors({ ...errors, password: '' });
                          }
                        }}
                        className={`input-field pr-11 w-full text-sm h-11 border-slate-300 focus:border-blue-500 focus:ring-blue-100 ${errors.password ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : ''}`}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors flex items-center justify-center p-1"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
                  </div>
                </div>
              </div>

              {/* SECTION 2: Home Address */}
              <div className="pt-2">
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Home Address
                  </h2>
                  <div className="flex-1 h-px bg-slate-100"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-4">
                  {/* Block Field */}
                  <div>
                    <label htmlFor="block" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Block / Sector <span className="text-red-500">*</span>
                    </label>
                    <InputField
                      id="block"
                      type="text"
                      placeholder="e.g., Block B or Sector G-10"
                      value={formData.block}
                      onChange={(e) => {
                        setFormData({ ...formData, block: e.target.value });
                        if (errors.block) {
                          setErrors({ ...errors, block: '' });
                        }
                      }}
                      error={errors.block}
                      className="h-11 text-sm border-slate-300 focus:border-blue-500 focus:ring-blue-100"
                      required
                    />
                  </div>

                  {/* Street Field */}
                  <div>
                    <label htmlFor="street" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Street <span className="text-red-500">*</span>
                    </label>
                    <InputField
                      id="street"
                      type="text"
                      placeholder="e.g., Street 14"
                      value={formData.street}
                      onChange={(e) => {
                        setFormData({ ...formData, street: e.target.value });
                        if (errors.street) {
                          setErrors({ ...errors, street: '' });
                        }
                      }}
                      error={errors.street}
                      className="h-11 text-sm border-slate-300 focus:border-blue-500 focus:ring-blue-100"
                      required
                    />
                  </div>

                  {/* House Number Field */}
                  <div>
                    <label htmlFor="houseNumber" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      House / Flat No. <span className="text-red-500">*</span>
                    </label>
                    <InputField
                      id="houseNumber"
                      type="text"
                      placeholder="e.g., House 25"
                      value={formData.houseNumber}
                      onChange={(e) => {
                        setFormData({ ...formData, houseNumber: e.target.value });
                        if (errors.houseNumber) {
                          setErrors({ ...errors, houseNumber: '' });
                        }
                      }}
                      error={errors.houseNumber}
                      className="h-11 text-sm border-slate-300 focus:border-blue-500 focus:ring-blue-100"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: Document Upload (Full Width, 150-170px Taller, Soft Tint Badge) */}
              <div className="pt-2">
                <label htmlFor="document" className="block text-xs font-semibold text-slate-700 mb-2">
                  Upload Proof of Residence (CNIC, Utility Bill, or Allotment Letter) <span className="text-red-500">*</span>
                </label>
                <div className="relative w-full">
                  <input
                    id="document"
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="document"
                    className={`
                    w-full min-h-[160px] flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer
                    transition-all duration-200 group
                    ${errors.document
                        ? 'border-red-300 bg-red-50/60'
                        : formData.document
                          ? 'border-blue-500 bg-blue-50/60'
                          : 'border-slate-300 bg-slate-50/60 hover:border-blue-500 hover:bg-blue-50/40'
                      }
                  `}
                  >
                    {/* Tinted Circular Badge for Upload Icon */}
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors ${
                      formData.document 
                        ? 'bg-blue-100 text-blue-600' 
                        : 'bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600'
                    }`}>
                      <Upload className="w-5 h-5" />
                    </div>

                    <div className="text-center">
                      <p className="text-sm font-medium text-slate-700">
                        {formData.document ? (
                          <span className="font-semibold text-blue-600">{formData.document.name}</span>
                        ) : (
                          <>
                            <span className="font-bold text-blue-600 group-hover:underline">Click to upload</span>{' '}
                            <span className="text-slate-600">or drag and drop</span>
                          </>
                        )}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        JPG, PNG, PDF, or DOC (Max 5MB)
                      </p>
                    </div>
                  </label>
                </div>
                {errors.document && (
                  <p className="text-red-500 text-xs mt-1.5">{errors.document}</p>
                )}
              </div>

              {/* Submit Button (Full Width, 48px height, smooth hover & shadow) */}
              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  isLoading={isLoading}
                  disabled={success}
                  className="h-12 font-bold text-sm tracking-wide shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-all rounded-xl"
                >
                  Create Account
                </Button>
                
                <p className="text-center text-xs text-slate-500 mt-3 sm:hidden">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => navigate(ROUTES.LOGIN)}
                    className="text-blue-600 hover:underline font-semibold"
                  >
                    Log In
                  </button>
                </p>
              </div>
            </form>
            </div>
          ) : (
            <div className="py-2 text-center flex flex-col items-center">
              <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mb-8 border border-blue-100 shadow-sm">
                <CheckCircle className="w-10 h-10 text-blue-600" />
              </div>
              
              <h1 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">Registration Submitted Successfully</h1>
              <p className="text-slate-500 text-sm font-medium leading-relaxed mb-12 max-w-sm">
                Your account is currently being reviewed by our administration team. You will receive a notification via email once your access is approved.
              </p>

              {/* Advanced UI Stepper Block */}
              <div className="w-full max-w-md mx-auto mb-14 relative hidden sm:block mt-6">
                 {/* Background Tracking Line */}
                 <div className="absolute top-5 left-[15%] right-[15%] h-[2px] bg-slate-100 z-0">
                   <div className="h-full bg-blue-600 w-1/2"></div>
                 </div>

                 <div className="flex justify-between relative z-10 px-2 text-center">
                    {/* Step 1: Submitted */}
                    <div className="flex flex-col items-center gap-3 w-1/3">
                       <div className="w-10 h-10 rounded-[12px] bg-blue-600 flex items-center justify-center text-white shadow-sm ring-[6px] ring-white">
                          <Check className="w-5 h-5" strokeWidth={2.5} />
                       </div>
                       <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wide">Submitted</span>
                    </div>

                    {/* Step 2: Verification */}
                    <div className="flex flex-col items-center gap-3 w-1/3">
                       <div className="w-10 h-10 rounded-[12px] bg-white border-2 border-blue-600 flex items-center justify-center text-blue-600 shadow-sm ring-[6px] ring-white">
                          <Hourglass className="w-5 h-5" strokeWidth={2} />
                       </div>
                       <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wide">Admin Verification</span>
                    </div>

                    {/* Step 3: Granted */}
                    <div className="flex flex-col items-center gap-3 w-1/3">
                       <div className="w-10 h-10 rounded-[12px] bg-slate-50 flex items-center justify-center text-slate-400 ring-[6px] ring-white">
                          <LogIn className="w-5 h-5" strokeWidth={2} />
                       </div>
                       <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Access Granted</span>
                    </div>
                 </div>
              </div>

              {/* Exact Navigational Layout from Layout File */}
              <div className="flex items-center gap-4 w-full max-w-sm mx-auto mb-12">
                 <button 
                  onClick={() => navigate(ROUTES.LOGIN)} 
                  className="flex-1 bg-[#1855d4] hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-md shadow-md shadow-blue-500/20 transition-all font-sans text-[15px]"
                 >
                   Return Home
                 </button>
                 <button 
                  onClick={() => navigate(ROUTES.LOGIN)} 
                  className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 font-semibold py-3 px-4 rounded-md transition-all font-sans text-[15px]"
                 >
                   Back to Login
                 </button>
              </div>

              <p className="text-[15px] text-slate-600">
                Need help? <a href="#" className="text-[#1855d4] hover:underline font-medium">Contact our support team.</a>
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Footer */}
      <div className="mt-12 text-center">
        <p className="text-xs text-gray-500">
          Complaint Management System v1.0 • All rights reserved
        </p>
      </div>
      </main>
    </div>
  );
};

export default RegisterPage;
