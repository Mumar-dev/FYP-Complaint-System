import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send,
  ImagePlus,
  CheckCircle,
  Mic,
  MicOff,
  MapPin,
  Home,
  Navigation,
  AlertCircle,
  Loader2,
  X,
  FileText,
  Sparkles,
  ArrowLeft,
  Copy,
  Check
} from 'lucide-react';
import { Button } from '@components/Common';
import { ROUTES } from '@constants/index';
import { useCreateComplaintMutation, useCheckDuplicateComplaintMutation } from '@/features/complaint/complaint.api';
import { useAuth } from '@/hooks/useAuth';
import { showSuccess, showError } from '@/utils/toast';

// Native Web Speech Integration Map
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}
const getSpeechRecognitionClass = () => {
  if (typeof window !== 'undefined') {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }
  return null;
};

const SubmitComplaintPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Network Mappings
  const [createComplaint, { isLoading: isSubmitting }] = useCreateComplaintMutation();
  const [checkDuplicate, { isLoading: isCheckingDuplicate }] = useCheckDuplicateComplaintMutation();

  // State Machine Architecture: input -> confirm -> success
  const [step, setStep] = useState<'input' | 'confirm'>('input');
  const [successPayload, setSuccessPayload] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [apiError, setApiError] = useState<string>('');

  // Duplicate Warning Modal State
  const [duplicateWarningModal, setDuplicateWarningModal] = useState<{
    open: boolean;
    duplicates: any[];
  }>({
    open: false,
    duplicates: [],
  });

  // Form Payload
  const [formData, setFormData] = useState({ description: '' });
  const [images, setImages] = useState<File[]>([]);

  // Location Mode: 'home' (registered home address) vs 'current' (GPS live)
  const [locationMode, setLocationMode] = useState<'home' | 'current'>('home');
  const [coordinates, setCoordinates] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const [isLocating, setIsLocating] = useState(false);
  const [manualAddress, setManualAddress] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Visual Image Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Web Speech Specific Maps
  const [isListening, setIsListening] = useState(false);
  const [lang, setLang] = useState<'en-US' | 'ur-PK'>('en-US');
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef<boolean>(false);
  const baseDescriptionRef = useRef<string>('');
  const SpeechRecognitionClass = getSpeechRecognitionClass();
  const supportsSpeech = !!SpeechRecognitionClass;

  // Retrieve user registered home address string
  const userHomeAddress = user?.profile?.address
    ? `House ${user.profile.address.houseNumber || ''}, Street ${user.profile.address.street || ''}, Block ${user.profile.address.block || ''}`.trim()
    : 'Registered Society Residence';

  // Keep isListeningRef in sync with state for robust event callbacks
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // Clean up recognition instance when unmounting
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore cleanup abort errors
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  const toggleListening = () => {
    const SpeechClass = getSpeechRecognitionClass();
    if (!SpeechClass) {
      showError('Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
      return;
    }

    // If currently listening, stop recognition gracefully
    if (isListeningRef.current) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      setIsListening(false);
      return;
    }

    // Snapshot current textarea description before dictation begins
    baseDescriptionRef.current = formData.description;

    try {
      // Abort any existing instance if still running
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }

      const recognition = new SpeechClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = lang;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = 0; i < event.results.length; ++i) {
          const result = event.results[i];
          const transcriptChunk = result[0]?.transcript || '';
          if (result.isFinal) {
            finalTranscript += transcriptChunk + ' ';
          } else {
            interimTranscript += transcriptChunk;
          }
        }

        const totalSpoken = (finalTranscript + interimTranscript).trim();
        if (totalSpoken) {
          const base = baseDescriptionRef.current.trim();
          const combined = base ? `${base} ${totalSpoken}` : totalSpoken;
          setFormData({ description: combined });
          if (errors.description) {
            setErrors(prev => ({ ...prev, description: '' }));
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech Recognition Error:', event.error, event);
        setIsListening(false);

        switch (event.error) {
          case 'not-allowed':
          case 'service-not-allowed':
            showError('Microphone access was denied. Please allow microphone permissions in your browser settings.');
            break;
          case 'no-speech':
            // Simply stop without annoying toast if no voice was detected
            break;
          case 'network':
            showError('Speech recognition network error. Please check your internet connection.');
            break;
          case 'audio-capture':
            showError('No microphone detected. Please plug in or enable an audio input device.');
            break;
          case 'aborted':
            // Intentional abort / stop
            break;
          default:
            showError(`Speech recognition error: ${event.error || 'Failed to capture voice.'}`);
            break;
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('Failed to start speech recognition:', err);
      setIsListening(false);
      showError('Could not start microphone speech recognition. Please check your browser permissions.');
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFormData({ description: e.target.value });
    if (errors.description) setErrors(prev => ({ ...prev, description: '' }));
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files) as File[];
      const validFiles: File[] = [];
      let sizeError = false;

      selectedFiles.forEach(file => {
        if (file.size > 5 * 1024 * 1024) sizeError = true;
        else validFiles.push(file);
      });

      if (sizeError) showError('One or more images exceeded the 5MB limit and were skipped.');

      setImages(prev => {
        const combo = [...prev, ...validFiles];
        if (combo.length > 3) {
          showError('Maximum 3 images allowed.');
          return combo.slice(0, 3);
        }
        return combo;
      });

      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const constructCaptureGeo = () => {
    setIsLocating(true);
    if (!navigator.geolocation) {
      showError('Geolocation is not supported by your browser.');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        setCoordinates({ lat: position.coords.latitude, lng: position.coords.longitude });
        setIsLocating(false);
        if (errors.location) setErrors(prev => ({ ...prev, location: '' }));
      },
      error => {
        console.error(error);
        showError('Unable to detect your current location. Please verify location permissions.');
        setIsLocating(false);
      }
    );
  };

  // Switch to GPS mode and auto-trigger detection if needed
  const handleSelectCurrentLocation = () => {
    setLocationMode('current');
    if (!coordinates.lat || !coordinates.lng) {
      constructCaptureGeo();
    }
    if (errors.location) setErrors(prev => ({ ...prev, location: '' }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.description.trim()) {
      newErrors.description = 'Please describe the problem you are experiencing.';
    }

    if (locationMode === 'current' && (!coordinates.lat || !coordinates.lng)) {
      newErrors.location = 'Please tap "Detect Location" to capture your current GPS coordinates.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const autoTitle =
    formData.description.split(' ').slice(0, 5).join(' ') +
    (formData.description.split(' ').length > 5 ? '...' : '');

  const handlePreSubmissionCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isListening) toggleListening();
    if (!validateForm()) return;

    // Run duplicate check
    try {
      const checkRes = await checkDuplicate({
        title: autoTitle || 'Facility Service Request',
        description: formData.description,
        locationType: locationMode,
        address: locationMode === 'home' ? userHomeAddress : undefined,
        lat: coordinates.lat || undefined,
        lng: coordinates.lng || undefined,
      }).unwrap();

      const foundDuplicates = checkRes?.data?.duplicates || [];
      if (foundDuplicates.length > 0) {
        setDuplicateWarningModal({
          open: true,
          duplicates: foundDuplicates,
        });
        return;
      }
    } catch (checkErr) {
      console.warn('[Duplicate Check Warning]:', checkErr);
      // Fail-open: continue to confirmation step if check endpoint errors
    }

    setStep('confirm');
  };

  const executeFinalSubmit = async () => {
    setApiError('');
    try {
      const payload = new FormData();
      payload.append('title', autoTitle || 'Facility Service Request');
      payload.append('description', formData.description);

      if (locationMode === 'home') {
        payload.append('locationType', 'home');
        payload.append('address', userHomeAddress);
      } else {
        payload.append('locationType', 'gps');
        if (coordinates.lat && coordinates.lng) {
          payload.append('lat', coordinates.lat.toString());
          payload.append('lng', coordinates.lng.toString());
        }
      }

      images.forEach(img => payload.append('images', img));

      const result: any = await createComplaint(payload).unwrap();
      const complaintRecord = result?.data?.complaint || result?.complaint || result?.data || result;
      setSuccessPayload(complaintRecord);
      showSuccess('Complaint submitted successfully');
    } catch (error: any) {
      const msg = error?.data?.message || 'Failed to submit complaint. Please check your connection.';
      setApiError(msg);
      showError(msg);
      setStep('input');
    }
  };

  const trackingId = successPayload?.complaintId
    ? (successPayload.complaintId.startsWith('#') ? successPayload.complaintId : `#${successPayload.complaintId}`)
    : successPayload?._id
    ? `#${successPayload._id.slice(-6).toUpperCase()}`
    : '#PENDING';

  const handleCopyTrackingId = () => {
    navigator.clipboard.writeText(trackingId);
    setCopied(true);
    showSuccess('Complaint ID copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto w-full -mt-4">
      {/* 1. SUCCESS STATE (TIGHT & BALANCED) */}
      {successPayload && (
        <div className="max-w-lg mx-auto mt-6 sm:mt-10 bg-white rounded-2xl border border-slate-200/90 p-8 sm:p-10 text-center shadow-lg shadow-slate-200/40 animate-in fade-in duration-200">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 border border-emerald-100 shadow-2xs">
            <CheckCircle className="w-8 h-8" />
          </div>
          
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Complaint Submitted!
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1.5 mb-6 leading-relaxed">
            We've received your report and will assign a team member to look into it soon.
          </p>

          {/* Polished Summary Box */}
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-4 w-full text-left divide-y divide-slate-200/70 mb-7">
            <div className="flex justify-between items-center text-xs pb-3">
              <span className="text-slate-500 font-semibold">Complaint ID</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-slate-900 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs">
                  {trackingId}
                </span>
                <button
                  type="button"
                  onClick={handleCopyTrackingId}
                  className="p-1 text-slate-400 hover:text-blue-600 hover:bg-white rounded transition-colors"
                  title="Copy Complaint ID"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Department Routing Info */}
            <div className="flex justify-between items-center text-xs py-3">
              <span className="text-slate-500 font-semibold">Assigned Department</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/80 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                {successPayload?.category || (typeof successPayload?.departmentId === 'object' ? successPayload?.departmentId?.name : null) || 'Auto Assigned'}
              </span>
            </div>

            <div className="flex justify-between items-center text-xs pt-3">
              <span className="text-slate-500 font-semibold">Status</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200/80 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                Waiting for Team
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => navigate(ROUTES.RESIDENT_MY_COMPLAINTS)}
              className="h-11 px-5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-all flex items-center justify-center"
            >
              View My Complaints
            </button>
            <button
              type="button"
              onClick={() => {
                setSuccessPayload(null);
                setFormData({ description: '' });
                setImages([]);
                setCoordinates({ lat: null, lng: null });
                setLocationMode('home');
                setStep('input');
              }}
              className="h-11 px-5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-xs flex items-center justify-center"
            >
              Submit Another
            </button>
          </div>
        </div>
      )}

      {/* 2. FORM STATE */}
      {!successPayload && (
        <>
          {/* Centered Modern Header with subtitle restored */}
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Submit a Complaint
            </h1>
            <p className="text-sm text-slate-500 mt-1.5 max-w-lg mx-auto leading-relaxed">
              Tell us what's wrong, and we'll send the right team to fix it.
            </p>
          </div>

          {apiError && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs sm:text-sm flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-none" />
              <span>{apiError}</span>
            </div>
          )}

          {/* Clean, spacious and modern Form Card */}
          {step === 'input' && (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-9 shadow-lg shadow-slate-200/50">
              <form onSubmit={handlePreSubmissionCheck} className="space-y-7">
                
                {/* SECTION 1: Describe the Issue */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs sm:text-sm font-semibold text-slate-800 flex items-center gap-1">
                      <span>What's the problem?</span>
                      <span className="text-rose-500">*</span>
                    </label>

                    {supportsSpeech ? (
                      <div className="flex items-center gap-2">
                        {/* Language Selector */}
                        <select
                          value={lang}
                          onChange={(e) => setLang(e.target.value as 'en-US' | 'ur-PK')}
                          disabled={isListening}
                          className="text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none cursor-pointer transition-colors disabled:opacity-60"
                          title="Recognition language"
                        >
                          <option value="en-US">English</option>
                          <option value="ur-PK">اردو (Urdu)</option>
                        </select>

                        <button
                          type="button"
                          onClick={toggleListening}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all shadow-xs cursor-pointer ${
                            isListening
                              ? 'bg-rose-500 text-white animate-pulse'
                              : 'bg-blue-50/80 hover:bg-blue-100/80 text-blue-600 border border-blue-200/80'
                          }`}
                          title={isListening ? 'Click to stop listening' : 'Click to dictate via microphone'}
                        >
                          {isListening ? (
                            <>
                              <MicOff className="w-3.5 h-3.5" />
                              <span>Listening... (Click to stop)</span>
                            </>
                          ) : (
                            <>
                              <Mic className="w-3.5 h-3.5 text-blue-600" />
                              <span>Speak Instead</span>
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => showError('Speech recognition is not supported in this browser. Please open in Google Chrome or Microsoft Edge.')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium text-slate-400 bg-slate-100 border border-slate-200 hover:text-slate-600 transition-colors"
                        title="Speech recognition not supported in this browser"
                      >
                        <MicOff className="w-3 h-3 text-slate-400" />
                        <span>Voice not supported</span>
                      </button>
                    )}
                  </div>

                  <div
                    className={`relative border rounded-xl transition-all duration-150 ${
                      isListening
                        ? 'border-rose-400 bg-rose-50/20'
                        : 'border-slate-300 bg-slate-50/40 focus-within:bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10'
                    }`}
                  >
                    <textarea
                      name="description"
                      placeholder="Describe the issue in simple words (e.g., water leakage, streetlight not working, garbage not collected)..."
                      value={formData.description}
                      onChange={handleTextChange}
                      rows={4}
                      className="w-full p-3.5 text-sm text-slate-800 placeholder:text-slate-400 bg-transparent focus:outline-none resize-none leading-relaxed"
                    />
                  </div>
                  {errors.description && (
                    <p className="text-rose-600 text-xs font-medium pl-0.5">{errors.description}</p>
                  )}
                </div>

                {/* SECTION 2: Add Photos (Full-width 3 Picture Grid) */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs sm:text-sm font-semibold text-slate-800">
                      Add Photos <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <span className="text-xs text-slate-400 font-medium">Max 3 photos · 5MB each</span>
                  </div>

                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleImageSelect}
                  />

                  {/* 3 Photo Slots - Full Width 3-Column Grid */}
                  <div className="grid grid-cols-3 gap-3.5 sm:gap-4 w-full">
                    {[0, 1, 2].map((slotIndex) => {
                      const img = images[slotIndex];
                      if (img) {
                        return (
                          <div
                            key={slotIndex}
                            className="relative min-h-[135px] sm:min-h-[145px] rounded-xl border border-slate-200 overflow-hidden group bg-slate-100 shadow-xs"
                          >
                            <img
                              src={URL.createObjectURL(img)}
                              alt={`preview-${slotIndex}`}
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => removeImage(slotIndex)}
                              className="absolute top-2 right-2 w-6 h-6 bg-black/60 hover:bg-rose-600 text-white rounded-full flex items-center justify-center transition-colors shadow-xs"
                              title="Remove photo"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      }

                      // Empty Slot - Clickable to upload
                      const isNextSlot = slotIndex === images.length;
                      return (
                        <button
                          key={slotIndex}
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className={`min-h-[135px] sm:min-h-[145px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 p-3 transition-all cursor-pointer ${
                            isNextSlot
                              ? 'border-blue-400 bg-blue-50/30 hover:bg-blue-50/70 hover:border-blue-500 text-blue-600'
                              : 'border-slate-200 bg-slate-50/40 hover:bg-slate-100/60 hover:border-slate-300 text-slate-400'
                          }`}
                          title={`Add photo ${slotIndex + 1}`}
                        >
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                            isNextSlot ? 'bg-blue-100/80 text-blue-600' : 'bg-slate-100 text-slate-400'
                          }`}>
                            <ImagePlus className="w-4 h-4" />
                          </div>
                          <span className={`text-xs font-semibold ${isNextSlot ? 'text-blue-600' : 'text-slate-500'}`}>
                            {isNextSlot ? 'Add Photo' : 'Add another'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* SECTION 3: Location Options */}
                <div className="space-y-2.5">
                  <label className="text-xs sm:text-sm font-semibold text-slate-800">
                    Where is the issue? <span className="text-rose-500">*</span>
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* OPTION A: Home Location */}
                    <button
                      type="button"
                      onClick={() => {
                        setLocationMode('home');
                        if (errors.location) setErrors(prev => ({ ...prev, location: '' }));
                      }}
                      className={`p-4 rounded-xl border text-left transition-all flex items-center gap-3.5 cursor-pointer min-h-[72px] ${
                        locationMode === 'home'
                          ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-none transition-colors ${
                          locationMode === 'home'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <Home className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs sm:text-sm font-bold text-slate-900">My Home</p>
                          <span
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                              locationMode === 'home'
                                ? 'border-blue-600 bg-blue-600'
                                : 'border-slate-300'
                            }`}
                          >
                            {locationMode === 'home' && <span className="w-1.5 h-1.5 bg-white rounded-full"></span>}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {userHomeAddress}
                        </p>
                      </div>
                    </button>

                    {/* OPTION B: Current Location (GPS) */}
                    <button
                      type="button"
                      onClick={handleSelectCurrentLocation}
                      className={`p-4 rounded-xl border text-left transition-all flex items-center gap-3.5 cursor-pointer min-h-[72px] ${
                        locationMode === 'current'
                          ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-none transition-colors ${
                          locationMode === 'current'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {isLocating ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Navigation className="w-5 h-5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs sm:text-sm font-bold text-slate-900">My Current Location</p>
                          <span
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                              locationMode === 'current'
                                ? 'border-blue-600 bg-blue-600'
                                : 'border-slate-300'
                            }`}
                          >
                            {locationMode === 'current' && <span className="w-1.5 h-1.5 bg-white rounded-full"></span>}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-0.5 font-mono">
                          {isLocating
                            ? 'Detecting GPS...'
                            : coordinates.lat
                            ? `GPS: ${coordinates.lat.toFixed(4)}, ${coordinates.lng!.toFixed(4)}`
                            : 'Use my current GPS location'}
                        </p>
                      </div>
                    </button>
                  </div>

                  {errors.location && (
                    <p className="text-rose-600 text-xs font-medium pl-0.5">{errors.location}</p>
                  )}
                </div>

                {/* Submit Action Buttons */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => navigate(ROUTES.RESIDENT_DASHBOARD)}
                    className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>

                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isCheckingDuplicate}
                    className="h-11 sm:h-12 px-7 font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-all flex items-center gap-2"
                  >
                    {isCheckingDuplicate ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Checking Status...</span>
                      </>
                    ) : (
                      <>
                        <span>Review & Submit</span>
                        <Send className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* 3. CONFIRMATION REVIEW STEP (COMPACT) */}
          {step === 'confirm' && (
            <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-xs space-y-3.5 animate-in fade-in duration-150">
              <div className="flex items-center gap-2.5 pb-2 border-b border-gray-100">
                <button
                  type="button"
                  onClick={() => setStep('input')}
                  className="p-1 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
                  title="Go back"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h2 className="text-sm font-bold text-gray-900">Confirm Complaint</h2>
                  <p className="text-[11px] text-gray-500">Please review before sending.</p>
                </div>
              </div>

              <div className="space-y-2.5 bg-gray-50/70 p-3.5 rounded-xl border border-gray-100 text-xs">
                <div>
                  <span className="text-[11px] text-gray-500 font-medium block mb-1">Description</span>
                  <p className="text-gray-800 bg-white p-2.5 rounded-lg border border-gray-200/60 whitespace-pre-wrap leading-relaxed">
                    {formData.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <div>
                    <span className="text-[11px] text-gray-500 font-medium block mb-1">Location</span>
                    <div className="text-gray-800 bg-white p-2 rounded-lg border border-gray-200/60 flex items-center gap-1.5">
                      {locationMode === 'home' ? (
                        <>
                          <Home className="w-3.5 h-3.5 text-blue-600 flex-none" />
                          <span className="truncate text-xs">{userHomeAddress}</span>
                        </>
                      ) : (
                        <>
                          <Navigation className="w-3.5 h-3.5 text-blue-600 flex-none" />
                          <span className="font-mono text-xs truncate">
                            {coordinates.lat?.toFixed(4)}, {coordinates.lng?.toFixed(4)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] text-gray-500 font-medium block mb-1">Photos</span>
                    <p className="text-gray-800 bg-white p-2 rounded-lg border border-gray-200/60 text-xs">
                      {images.length > 0 ? `${images.length} photo(s)` : 'None'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setStep('input')}
                  disabled={isSubmitting}
                  className="px-3.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Edit
                </button>
                <Button
                  onClick={executeFinalSubmit}
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <span>Confirm & Send</span>
                      <Send className="w-3 h-3" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* DUPLICATE COMPLAINT WARNING MODAL */}
      {duplicateWarningModal.open && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900 leading-snug">
                  Similar Complaint Already Open
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  We found an active complaint for this issue at your location. Creating duplicate requests may slow down resolution.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDuplicateWarningModal({ open: false, duplicates: [] })}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List of matching tickets */}
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {duplicateWarningModal.duplicates.map((item: any) => (
                <div
                  key={item._id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-blue-300 transition-all text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                      {item.ticketId}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-200">
                      {item.status?.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="font-semibold text-slate-900 line-clamp-1">{item.title}</p>
                  <p className="text-[11px] text-slate-500 line-clamp-2">{item.description}</p>
                  <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Submitted: {new Date(item.createdAt).toLocaleDateString()}</span>
                    <button
                      type="button"
                      onClick={() => navigate(ROUTES.RESIDENT_COMPLAINT_DETAIL.replace(':id', item._id))}
                      className="text-blue-600 hover:text-blue-700 font-semibold hover:underline"
                    >
                      View Ticket →
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setDuplicateWarningModal({ open: false, duplicates: [] });
                  setStep('confirm');
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Submit Anyway
              </button>
              {duplicateWarningModal.duplicates[0] && (
                <Button
                  variant="primary"
                  onClick={() => navigate(ROUTES.RESIDENT_COMPLAINT_DETAIL.replace(':id', duplicateWarningModal.duplicates[0]._id))}
                  className="px-4 py-2 text-xs font-semibold rounded-xl shadow-xs"
                >
                  View Existing Ticket
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubmitComplaintPage;
