import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

import CarsPage from "./CarsPage";
import CalendarBookingPage from "./CalendarBookingPage";

import {
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle,
  AlertCircle,
  Menu,
  ChevronLeft,
  ChevronRight,
  Calendar,
  User,
  Clock,
  CreditCard,
  Upload,
  MapPin,
  Phone,
  Mail
} from "lucide-react";

import { Car, Users, Gauge } from "lucide-react";

import {
  FaFacebookF,
  FaTwitter,
  FaInstagram,
  FaLinkedinIn
} from "react-icons/fa";

import {
  IoSpeedometerOutline,
  IoPeopleOutline,
  IoCarOutline
} from "react-icons/io5";

import * as firebaseService from "./lib/firebaseService";


import HeroBg from "./assets/HeroBg.png";
import logo from "./assets/logo/logoRental.png";
import aboutcra from "./assets/aboutuscar.jpg";
import carabout from "./assets/carabout.png";
import aboutcircle from "./assets/circleBg.jpg";
import carImage from "./assets/Cars.png";
import faqscar from "./assets/faqspic.png";
import faqscar1 from "./assets/faqscar.png";
import carIcon from "./assets/iconscar.png";
import calendarIcon from "./assets/iconscalendar.png";
import supportIcon from "./assets/iconssupport.png";
import BackgroundImage from "./assets/HeroPage/section_bg2.png";
import defaultBackground from "./assets/CarScreen/defaultBg.png";

import RentalBot from "../Chatbot/Rentalbot";


/* ===========================
   ✅ Intersection Observer Hook for Animations
   =========================== */
const useScrollAnimation = () => {
  const [ref, setRef] = useState(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (!ref) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true) // Never resets
        }
        
        // AFTER: Animation triggers every time
        setIsVisible(entry.isIntersecting) 
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
      }
    )

    observer.observe(ref)
    return () => observer.disconnect()
  }, [ref])

  return [setRef, isVisible]
}

/* ===========================
   ✅ Success/Error Toast
   =========================== */
const Toast = ({ type, message, isVisible, onClose }) => {
  useEffect(() => {
    if (!isVisible) return
    const t = setTimeout(onClose, 5000)
    return () => clearTimeout(t)
  }, [isVisible, onClose])

  if (!isVisible) return null

  return (
    <div className="fixed top-4 right-4 z-[9999] animate-slide-in">
      <div
        className={`flex items-center p-4 rounded-lg shadow-lg ${
          type === "success"
            ? "bg-green-100 text-green-800 border border-green-200"
            : "bg-red-100 text-red-800 border border-red-200"
        }`}
      >
        {type === "success" ? <CheckCircle className="h-5 w-5 mr-3" /> : <AlertCircle className="h-5 w-5 mr-3" />}
        <span className="text-sm font-medium">{message}</span>
        <button onClick={onClose} className="ml-4 text-gray-400 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
/* ===========================
   DetailsModal - Clean & Responsive
   =========================== */
const DetailsModal = ({ isOpen, onClose, car, onRentClick }) => {
  const [variants, setVariants] = useState([]);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [variantStats, setVariantStats] = useState({});
  const [colorGroups, setColorGroups] = useState([]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  useEffect(() => {
    const fetchVariants = async () => {
      if (!car?.id) return;
      
      const variantsData = await firebaseService.listVariantsByVehicleId(car.id);
      const today = new Date().toISOString().split('T')[0];
      const allBookings = await firebaseService.listConfirmedBookings();
      const bookings = allBookings.filter(
        (b) => b.status === "confirmed" && b.rental_end_date >= today && b.rental_start_date <= today
      );

      const stats = {};
      variantsData.forEach(variant => {
        const isRented = bookings?.some(b => b.vehicle_variant_id === variant.id);
        stats[variant.id] = {
          isAvailable: variant.is_available && !isRented,
          isRented: isRented,
          isMaintenance: !variant.is_available
        };
      });

      const groups = {};
      variantsData.forEach(variant => {
        const colorKey = variant.color.toLowerCase().trim();
        if (!groups[colorKey]) {
          groups[colorKey] = {
            color: variant.color,
            variants: []
          };
        }
        groups[colorKey].variants.push(variant);
      });

      setVariants(variantsData || []);
      setVariantStats(stats);
      setColorGroups(Object.values(groups));
      
      const firstAvailable = variantsData.find(v => stats[v.id]?.isAvailable);
      setSelectedVariant(firstAvailable || variantsData[0]);
    };
    
    if (isOpen) fetchVariants();
  }, [isOpen, car]);

  if (!isOpen || !car) return null;

  // ── Fuel helpers ────────────────────────────────────────────────────────
  const getFuelColor = (fuelType) => {
    if (!fuelType) return "#f59e0b"
    const f = fuelType.toLowerCase()
    if (f.includes("electric"))                         return "#3b82f6"
    if (f.includes("hybrid") || f.includes("plug"))    return "#16a34a"
    if (f.includes("diesel"))                           return "#0ea5e9"
    if (f.includes("cng") || f.includes("compressed")) return "#8b5cf6"
    if (f.includes("lpg") || f.includes("liquefied"))  return "#f97316"
    return "#f59e0b"
  }

  const GasPumpSVG = ({ strokeColor }) => (
    <svg
      width="12" height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke={strokeColor}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 22V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16H3z" />
      <path d="M15 8h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3" />
      <rect x="19" y="10" width="2" height="3" rx="1" />
      <line x1="7" y1="14" x2="11" y2="14" />
      <rect x="5" y="7" width="8" height="5" rx="1" />
    </svg>
  )
  // ────────────────────────────────────────────────────────────────────────

  const getColorHex = (colorName) => {
    const name = colorName.toLowerCase();
    if (name.includes("white") || name.includes("pearl")) return "#ffffff";
    if (name.includes("black") || name.includes("midnight")) return "#1f2937";
    if (name.includes("silver") || name.includes("metallic")) return "#9ca3af";
    if (name.includes("red")) return "#dc2626";
    if (name.includes("blue")) return "#2563eb";
    if (name.includes("gray") || name.includes("grey")) return "#6b7280";
    if (name.includes("green")) return "#16a34a";
    if (name.includes("yellow") || name.includes("gold")) return "#facc15";
    if (name.includes("orange")) return "#f97316";
    if (name.includes("brown")) return "#7c4a31";
    if (name.includes("purple")) return "#8b5cf6";
    if (name.includes("pink")) return "#ec4899";
    if (name.includes("beige")) return "#e5decf";
    return "#e5e7eb";
  };

  const renderColorSwatch = (colorGroup) => {
    const bgColor = getColorHex(colorGroup.color);
    const availableCount = colorGroup.variants.filter(v => variantStats[v.id]?.isAvailable).length;
    const totalCount = colorGroup.variants.length;
    const hasAvailable = availableCount > 0;
    const isSelected = colorGroup.variants.some(v => v.id === selectedVariant?.id);

    return (
      <button
        key={colorGroup.color}
        onClick={() => {
          const firstAvailable = colorGroup.variants.find(v => variantStats[v.id]?.isAvailable);
          setSelectedVariant(firstAvailable || colorGroup.variants[0]);
        }}
        disabled={!hasAvailable}
        className={`relative p-2 rounded-lg border-2 transition-all duration-200
          ${isSelected 
            ? 'border-black bg-gray-50 shadow-md' 
            : hasAvailable 
              ? 'border-gray-200 hover:border-gray-400 bg-white' 
              : 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
          }
        `}
      >
        <div className="flex flex-col items-center gap-1">
          <div className="relative">
            <div
              className={`w-10 h-10 rounded-full ${isSelected ? 'ring-2 ring-black ring-offset-1' : ''}`}
              style={{
                backgroundColor: bgColor,
                border: bgColor === "#ffffff" ? "2px solid #e5e7eb" : "none",
              }}
            />
            
            {totalCount > 1 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-black text-white text-[9px] rounded-full flex items-center justify-center font-bold border border-white">
                {totalCount}
              </span>
            )}
            
            {!hasAvailable && (
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border border-white" />
            )}
          </div>
          
          <div className="text-center">
            <div className={`text-xs font-semibold ${isSelected ? 'text-black' : 'text-gray-700'}`}>
              {colorGroup.color}
            </div>
            <div className="text-[10px] text-gray-500">
              {availableCount}/{totalCount}
            </div>
          </div>
        </div>
      </button>
    );
  };

  const stats = variantStats[selectedVariant?.id] || {};
  const fuelColor = getFuelColor(car.fuel_type);

  return (
    <div className="fixed inset-0 bg-white z-[9999] flex flex-col">
      
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="text-2xl font-bold text-gray-900">Vehicle Details</div>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all"
        >
          <X className="w-5 h-5 text-gray-900" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="grid lg:grid-cols-2 gap-0">
          
          {/* LEFT - Car Image */}
          <div className="relative bg-white p-8 flex items-center justify-center min-h-[400px]">
            <div className="absolute inset-0">
              <img 
                src={defaultBackground} 
                alt="Background" 
                className="w-full h-full object-cover opacity-100"
              />
            </div>
            
            <div className="relative z-10 w-full max-w-2xl">
              <img
                src={selectedVariant?.image_url || car.image_url || defaultBackground}
                alt={`${car.make} ${car.model}`}
                className="w-full h-auto object-contain drop-shadow-2xl"
              />
            </div>
          </div>
  
          {/* RIGHT - All Details */}
          <div className="p-6 lg:p-8 bg-gray-50">
            <div className="max-w-2xl mx-auto space-y-4">
              
              {/* Vehicle Title */}
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <h1 className="text-2xl font-bold text-gray-900">{car.make} {car.model}</h1>
                <p className="text-sm text-gray-500 mt-1">{car.year}</p>
              </div>

              {/* Price */}
              <div className="bg-black text-white rounded-xl p-4">
                <div className="text-xs text-gray-300 mb-1">Daily Rental Rate</div>
                <div className="text-3xl font-bold">
                  ₱{selectedVariant?.price_per_day?.toLocaleString() || car.price_per_day?.toLocaleString()}
                  <span className="text-base font-normal text-gray-400 ml-2">/day</span>
                </div>
              </div>

              {/* Deposit Required */}
              {car.deposit_amount && (
                <div className="bg-amber-50 rounded-xl p-4 border-2 border-amber-200">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-600 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-amber-900 mb-1">
                        Security Deposit Required
                      </div>
                      <div className="text-2xl font-bold text-amber-900 mb-1">
                        ₱{Number(car.deposit_amount).toLocaleString()}
                      </div>
                      <div className="text-xs text-amber-700">
                        Refundable deposit • Returned after vehicle inspection
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Specifications */}
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <h3 className="text-base font-bold text-gray-900 mb-3">Specifications</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Mileage</div>
                    <div className="text-sm font-semibold text-gray-900">
                      {car.mileage ? `${Number(car.mileage).toLocaleString()} km` : "N/A"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Seats</div>
                    <div className="text-sm font-semibold text-gray-900">{car.seats} Seater</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Type</div>
                    <div className="text-sm font-semibold text-gray-900">{car.type || "N/A"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Year</div>
                    <div className="text-sm font-semibold text-gray-900">{car.year}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Fuel Type</div>
                    <div
                      className="text-sm font-semibold flex items-center gap-1.5"
                      style={{ color: fuelColor }}
                    >
                      <div
                        className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${fuelColor}1a` }}
                      >
                        <GasPumpSVG strokeColor={fuelColor} />
                      </div>
                      {car.fuel_type || "N/A"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Deposit</div>
                    <div className="text-sm font-semibold text-amber-700">
                      ₱{Number(car.deposit_amount || 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
  
              {/* Description */}
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <h3 className="text-base font-bold text-gray-900 mb-2">Description</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {car.description || "Experience luxury and performance with this premium vehicle. Perfect for business trips, special occasions, or when you simply want to enjoy the finest driving experience."}
                </p>
              </div>
  
              {/* Color Selection */}
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <h3 className="text-base font-bold text-gray-900 mb-3">Available Colors</h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {colorGroups.map(renderColorSwatch)}
                </div>
              </div>

              {/* Selected Variant Info */}
              {selectedVariant && (
                <div className={`rounded-xl p-4 border-2 ${
                  stats.isAvailable ? 'bg-green-50 border-green-200' :
                  stats.isRented ? 'bg-orange-50 border-orange-200' :
                  'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-gray-600 mb-1">Selected Color</div>
                      <div className="text-lg font-bold text-gray-900">{selectedVariant.color}</div>
                      <div className="text-xs text-gray-600 mt-1">
                        Plate: <span className="font-semibold">{selectedVariant.plate_number}</span>
                      </div>
                    </div>
                    <div className={`px-3 py-1.5 rounded-lg font-semibold text-xs ${
                      stats.isAvailable ? 'bg-green-600 text-white' :
                      stats.isRented ? 'bg-orange-600 text-white' :
                      'bg-red-600 text-white'
                    }`}>
                      {stats.isAvailable ? '✓ Available' : stats.isRented ? 'Rented' : 'Maintenance'}
                    </div>
                  </div>
                </div>
              )}

              {/* Book Button */}
              <button
                onClick={() => {
                  if (!stats.isAvailable) {
                    alert(stats.isRented 
                      ? 'This color is currently rented. Please select another color or check back later.' 
                      : 'This vehicle is under maintenance. Please select another color.');
                    return;
                  }
                  onClose();
                  onRentClick(car, selectedVariant);
                }}
                disabled={!stats.isAvailable}
                className={`w-full py-3 rounded-xl text-base font-bold transition-all ${
                  stats.isAvailable
                    ? 'bg-black text-white hover:bg-gray-800'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {stats.isAvailable ? 'Book This Vehicle' : stats.isRented ? 'Currently Rented' : 'Unavailable'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
/* ===========================
   Rental Modal - Complete with Delivery Fee Note
   =========================== */
const RentalModal = ({ isOpen, onClose, selectedCar, refreshBookings }) => {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    pickupDate: "",
    returnDate: "",
    pickupLocation: "",
    licenseNumber: "",
    vehicleVariantId: "",
    deliveryOption: "pickup",
    deliveryAddress: "",
  })
  const [variants, setVariants] = useState([])
  const [colorGroups, setColorGroups] = useState([])
  const [selectedVariant, setSelectedVariant] = useState(null)
  const [govIdFile, setGovIdFile] = useState(null)
  const [govIdPreview, setGovIdPreview] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [totalPrice, setTotalPrice] = useState(0)
  const [rentalDays, setRentalDays] = useState(0)
  const [toast, setToast] = useState({ type: "", message: "", isVisible: false })
  const [variantsLoading, setVariantsLoading] = useState(false)
  const [bookedDates, setBookedDates] = useState([])
  const [contractModalVisible, setContractModalVisible] = useState(false)
  const [contractSignature, setContractSignature] = useState("")
  const [contractError, setContractError] = useState("")

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "auto"
    return () => (document.body.style.overflow = "auto")
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      setContractModalVisible(false)
      setContractSignature("")
      setContractError("")
    }
  }, [isOpen])

  const fetchBookedDates = async (variantId) => {
    if (!variantId) return
    try {
      const data = await firebaseService.listBookingsByVariantId(variantId)
      if (data?.length) {
        const dates = []
        data.forEach(booking => {
          const start = new Date(booking.rental_start_date)
          const end = new Date(booking.rental_end_date)
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            dates.push(new Date(d).toISOString().split('T')[0])
          }
        })
        setBookedDates(dates)
      }
    } catch (err) {
      console.error('Error fetching booked dates:', err)
    }
  }

  const refreshVariants = async () => {
    if (!selectedCar?.id) return
    setVariantsLoading(true)
    try {
      const data = await firebaseService.listVariantsByVehicleId(selectedCar.id)
      if (data?.length) {
        setVariants(data)
        const groups = {}
        data.forEach(variant => {
          const colorKey = variant.color.toLowerCase().trim()
          if (!groups[colorKey]) {
            groups[colorKey] = { color: variant.color, variants: [] }
          }
          groups[colorKey].variants.push(variant)
        })
        setColorGroups(Object.values(groups))
        const firstVariant = data.find(v => v.is_available) || data[0]
        if (firstVariant) {
          setSelectedVariant(firstVariant)
          setFormData((s) => ({ ...s, vehicleVariantId: firstVariant.id }))
          fetchBookedDates(firstVariant.id)
        }
      }
    } catch (err) {
      console.error('Error fetching variants:', err)
      setVariants([])
      setColorGroups([])
    } finally {
      setVariantsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) refreshVariants()
  }, [isOpen, selectedCar])

  useEffect(() => {
    if (formData.pickupDate && formData.returnDate && selectedCar) {
      const start = new Date(formData.pickupDate)
      const end = new Date(formData.returnDate)
      const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24))
      if (diffDays >= 0) {
        const days = diffDays === 0 ? 1 : diffDays
        setRentalDays(days)
        const basePrice = days * (selectedVariant?.price_per_day || selectedCar.price_per_day || 0)
        setTotalPrice(basePrice)
      } else {
        setRentalDays(0)
        setTotalPrice(0)
      }
    } else {
      setRentalDays(0)
      setTotalPrice(0)
    }
  }, [formData.pickupDate, formData.returnDate, selectedCar, selectedVariant])

  const showToast = (type, message) => setToast({ type, message, isVisible: true })
  const hideToast = () => setToast((t) => ({ ...t, isVisible: false }))

  const normalizeName = (value = "") => value.replace(/\s+/g, " ").trim().toLowerCase()

  const formatContractDate = (value) => {
    if (!value) return ""
    return new Date(value).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const getVehicleSummary = () => {
    const parts = [selectedCar?.year, selectedCar?.make, selectedCar?.model].filter(Boolean)
    const base = parts.join(" ") || "Selected vehicle"
    const color = selectedVariant?.color ? ` (${selectedVariant.color})` : ""
    return `${base}${color}`
  }

  const buildContractDetails = (signedAtISO) => {
    const customerName = formData.fullName.trim()
    const rentalStart = formatContractDate(formData.pickupDate)
    const rentalEnd = formatContractDate(formData.returnDate)
    const signatureDate = formatContractDate(signedAtISO)
    const vehicleSummary = getVehicleSummary()

    const contractParagraphs = [
      `I, ${customerName}, confirm that I am renting ${vehicleSummary} from The Rental Den for the period of ${rentalStart} to ${rentalEnd}.`,
      "I accept full financial responsibility for any loss, collision damage, vandalism, or civil penalties incurred during this rental period, apart from normal wear and tear.",
      "I agree to immediately report any incident to The Rental Den, to cooperate with insurance requirements, and to settle any repair or downtime costs that are not covered by insurance or security deposits.",
      `By typing my full legal name, I agree that this serves as my digital signature dated ${signatureDate}.`,
    ]

    return {
      text: contractParagraphs.join("\n\n"),
      signedName: customerName,
      signedAt: signedAtISO,
    }
  }

  const validateBookingForm = () => {
    if (!formData.vehicleVariantId) return "Please select a color variant."
    if (!govIdFile) return "Please upload a valid Driver's License Card image."
    if (!formData.pickupDate || !formData.returnDate) return "Please set a valid rental date range."
    if (formData.deliveryOption === 'deliver' && !formData.deliveryAddress) return "Please enter a delivery address."

    const start = new Date(formData.pickupDate)
    const end = new Date(formData.returnDate)

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      return "Please set a valid rental date range."
    }

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = new Date(d).toISOString().split("T")[0]
      if (isDateBooked(dateStr)) {
        return "Selected dates are already booked. Please choose different dates."
      }
    }

    return null
  }

  const handleInputChange = (e) => setFormData((s) => ({ ...s, [e.target.name]: e.target.value }))

  const handleVariantSelect = (colorGroup) => {
    const firstAvailable = colorGroup.variants.find(v => v.is_available) || colorGroup.variants[0]
    setSelectedVariant(firstAvailable)
    setFormData((s) => ({ ...s, vehicleVariantId: firstAvailable?.id || "", pickupDate: "", returnDate: "" }))
    fetchBookedDates(firstAvailable?.id)
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const allowed = ["image/jpeg", "image/png", "image/jpg"]
    if (!allowed.includes(file.type)) { showToast("error", "Only JPG/PNG images allowed."); return }
    if (file.size > 5 * 1024 * 1024) { showToast("error", "File size must be under 5MB"); return }
    setGovIdFile(file)
    setGovIdPreview(URL.createObjectURL(file))
  }

  const isDateBooked = (dateString) => bookedDates.includes(dateString)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (isSubmitting) return
    const validationError = validateBookingForm()
    if (validationError) { showToast("error", validationError); return }
    setContractSignature("")
    setContractError("")
    setContractModalVisible(true)
  }

  const submitBooking = async (contractDetails) => {
    setIsSubmitting(true)
    try {
      const fileName = `${Date.now()}_${govIdFile.name}`
      const govIdUrl = await firebaseService.uploadGovId(fileName, govIdFile)

      const vehicleData = await firebaseService.getVehicleById(selectedCar.id)
      const ownerUserId = vehicleData?.user_id || null
      if (!ownerUserId) throw new Error("Could not determine vehicle owner")

      const bookingRow = {
        vehicle_id: selectedCar.id,
        vehicle_variant_id: formData.vehicleVariantId,
        customer_name: formData.fullName,
        customer_email: formData.email,
        customer_phone: formData.phone,
        rental_start_date: formData.pickupDate,
        rental_end_date: formData.returnDate,
        pickup_location: formData.deliveryOption === 'deliver' ? formData.deliveryAddress : null,
        delivery_option: formData.deliveryOption,
        delivery_address: formData.deliveryOption === 'deliver' ? formData.deliveryAddress : null,
        license_number: formData.licenseNumber,
        total_price: totalPrice,
        gov_id_url: govIdUrl,
        status: "pending",
        contract_text: contractDetails?.text || null,
        contract_signed_name: contractDetails?.signedName || null,
        contract_signed_at: contractDetails?.signedAt || null,
      }

      const { id } = await firebaseService.createBooking(bookingRow, ownerUserId)
      const insertedBooking = { id, ...bookingRow }

      try {
        const emailData = {
          customer_email: formData.email,
          customer_name: formData.fullName,
          bookingId: insertedBooking.id,
          vehicleMake: selectedCar.make,
          vehicleModel: selectedCar.model,
          vehicleYear: selectedCar.year,
          variantColor: selectedVariant?.color,
          rental_start_date: formData.pickupDate,
          rental_end_date: formData.returnDate,
          delivery_option: formData.deliveryOption,
          total_price: totalPrice,
          contractText: contractDetails?.text,
          contractSignedName: contractDetails?.signedName,
          contractSignedAt: contractDetails?.signedAt,
          contractVehicleSummary: getVehicleSummary(),
        }

        const emailResponse = await fetch('http://localhost:3001/api/send-booking-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(emailData)
        })

        const emailResult = await emailResponse.json()
        if (emailResult.success) {
          showToast("success", "Booking submitted and confirmation email sent!")
        } else {
          showToast("success", "Booking submitted! (Email notification may be delayed)")
        }
      } catch (emailError) {
        console.error("Email service error:", emailError)
        showToast("success", "Booking submitted! (Email notification may be delayed)")
      }

      await refreshBookings?.()
      await refreshVariants()
      setTimeout(() => onClose(), 1200)

    } catch (err) {
      console.error(err)
      showToast("error", "Booking failed. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleContractConfirm = async () => {
    if (isSubmitting) return
    const validationError = validateBookingForm()
    if (validationError) { showToast("error", validationError); setContractError(validationError); return }
    if (!contractSignature.trim()) { setContractError("Please type your full name to sign the contract."); return }
    if (normalizeName(contractSignature) !== normalizeName(formData.fullName)) {
      setContractError("The name you entered must exactly match your full name on the form.")
      return
    }
    const signedAtISO = new Date().toISOString()
    const contractDetails = buildContractDetails(signedAtISO)
    setContractModalVisible(false)
    setContractError("")
    await submitBooking(contractDetails)
  }

  const handleContractClose = () => {
    if (isSubmitting) return
    setContractModalVisible(false)
    setContractSignature("")
    setContractError("")
  }

  // ── Fuel helpers ────────────────────────────────────────────────────────
  const getFuelColor = (fuelType) => {
    if (!fuelType) return "#f59e0b"
    const f = fuelType.toLowerCase()
    if (f.includes("electric"))                         return "#3b82f6"
    if (f.includes("hybrid") || f.includes("plug"))    return "#16a34a"
    if (f.includes("diesel"))                           return "#0ea5e9"
    if (f.includes("cng") || f.includes("compressed")) return "#8b5cf6"
    if (f.includes("lpg") || f.includes("liquefied"))  return "#f97316"
    return "#f59e0b"
  }

  const GasPumpSVG = ({ strokeColor }) => (
    <svg
      width="14" height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke={strokeColor}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 22V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16H3z" />
      <path d="M15 8h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3" />
      <rect x="19" y="10" width="2" height="3" rx="1" />
      <line x1="7" y1="14" x2="11" y2="14" />
      <rect x="5" y="7" width="8" height="5" rx="1" />
    </svg>
  )
  // ────────────────────────────────────────────────────────────────────────

  const getColorHex = (colorName) => {
    const name = colorName.toLowerCase()
    if (name.includes('white') || name.includes('pearl')) return '#ffffff'
    if (name.includes('black') || name.includes('midnight')) return '#1f2937'
    if (name.includes('silver') || name.includes('metallic')) return '#9ca3af'
    if (name.includes('red')) return '#dc2626'
    if (name.includes('blue')) return '#2563eb'
    if (name.includes('gray') || name.includes('grey')) return '#6b7280'
    if (name.includes('green')) return '#16a34a'
    if (name.includes('yellow') || name.includes('gold')) return '#facc15'
    if (name.includes('orange')) return '#f97316'
    if (name.includes('brown')) return '#7c4a31'
    if (name.includes('beige')) return '#e5decf'
    if (name.includes('purple')) return '#8b5cf6'
    if (name.includes('pink')) return '#ec4899'
    return '#e5e7eb'
  }

  const renderColorGroupSwatch = (colorGroup) => {
    const bgColor = getColorHex(colorGroup.color)
    const availableCount = colorGroup.variants.filter(v => v.is_available).length
    const totalCount = colorGroup.variants.length
    const isSelected = colorGroup.variants.some(v => v.id === selectedVariant?.id)
    return (
      <div key={colorGroup.color} className="relative group">
        <button
          onClick={() => handleVariantSelect(colorGroup)}
          disabled={availableCount === 0}
          className={`w-8 h-8 rounded-full cursor-pointer transition-all duration-200
            ${isSelected ? "ring-2 ring-black ring-offset-2 scale-110" : ""}
            ${availableCount === 0 ? "opacity-40 cursor-not-allowed" : "hover:scale-110 hover:shadow-lg"}
          `}
          style={{
            backgroundColor: bgColor,
            border: bgColor === '#ffffff' ? '2px solid #e5e7eb' : 'none',
          }}
          title={`${colorGroup.color} - ${availableCount}/${totalCount} available`}
        />
        {totalCount > 1 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-black text-white text-[9px] rounded-full flex items-center justify-center font-bold border border-white">
            {totalCount}
          </span>
        )}
        {availableCount === 0 && (
          <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
        )}
      </div>
    )
  }

  if (!isOpen) return null

  const displayCar = selectedCar || {
    make: 'Toyota', model: 'Camry', year: 2024, seats: 5,
    price_per_day: 3500, image_url: defaultBackground
  }

  const basePrice = rentalDays * (selectedVariant?.price_per_day || displayCar?.price_per_day || 0)
  const fuelColor = getFuelColor(displayCar?.fuel_type)

  return (
    <>
      <Toast {...toast} onClose={hideToast} />
      <div className="fixed inset-0 bg-white z-[9998] flex flex-col">
        <div className="bg-white w-full h-full overflow-hidden flex flex-col">

          {/* Header */}
          <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Complete Your Booking</h2>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all duration-200 hover:scale-105"
            >
              <X className="w-5 h-5 text-gray-900" />
            </button>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid lg:grid-cols-5 gap-0">

              {/* Left — Vehicle Display */}
              <div className="lg:col-span-2 bg-gradient-to-br from-gray-50 to-white p-6">
                <div className="max-w-md mx-auto space-y-6">

                  <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl border border-gray-200">
                    <img src={defaultBackground} className="absolute inset-0 w-full h-full object-cover" alt="Background" />
                    {(selectedVariant?.image_url || displayCar?.image_url) && (
                      <div className="absolute inset-0 flex items-center justify-center p-6">
                        <img
                          src={selectedVariant?.image_url || displayCar?.image_url}
                          alt={`${displayCar?.make} ${displayCar?.model}`}
                          className="w-full h-full object-contain drop-shadow-2xl"
                        />
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
                    <h3 className="text-2xl font-bold text-gray-900 mb-3">{displayCar?.make} {displayCar?.model}</h3>
                    <div className="flex items-center gap-3 mb-4 flex-wrap">
                      <span className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full text-sm font-medium">
                        <Calendar className="w-4 h-4" />{displayCar?.year}
                      </span>
                      <span className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full text-sm font-medium">
                        <IoPeopleOutline className="w-4 h-4" />{displayCar?.seats} seats
                      </span>
                      {displayCar?.fuel_type && (
                        <span
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold"
                          style={{ color: fuelColor, backgroundColor: `${fuelColor}1a` }}
                        >
                          <GasPumpSVG strokeColor={fuelColor} />
                          {displayCar.fuel_type}
                        </span>
                      )}
                    </div>
                    <div className="border-t border-gray-200 pt-4 mb-4">
                      <div className="text-3xl font-bold text-gray-900">
                        ₱{(selectedVariant?.price_per_day || displayCar?.price_per_day)?.toLocaleString()}
                        <span className="text-base font-normal text-gray-600 ml-2">/day</span>
                      </div>
                    </div>

                    {/* Deposit Info */}
                    {displayCar?.deposit_amount && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                        <div className="flex items-center gap-2 mb-1">
                          <svg className="w-4 h-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                          </svg>
                          <span className="text-xs font-bold text-amber-900">Security Deposit Required</span>
                        </div>
                        <div className="text-lg font-bold text-amber-900">
                          ₱{Number(displayCar.deposit_amount).toLocaleString()}
                        </div>
                        <div className="text-xs text-amber-700 mt-1">
                          Refundable • Returned after inspection
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">Select Color</label>
                      <div className="flex flex-wrap gap-3 mb-3">{colorGroups.map(renderColorGroupSwatch)}</div>
                      {selectedVariant && (
                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                          <p className="text-sm text-gray-600">
                            <span className="font-semibold text-gray-900">{selectedVariant.color}</span>
                            {colorGroups.length > 0 && (
                              <span className="ml-2">
                                ({colorGroups.find(g => g.variants.some(v => v.id === selectedVariant.id))?.variants.filter(v => v.is_available).length || 0} available)
                              </span>
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right — Form */}
              <div className="lg:col-span-3 p-6 lg:p-8">
                <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-6">

                  {/* Personal Information */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                        <User className="w-4 h-4 text-white" />
                      </div>
                      Personal Information
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name *</label>
                        <input type="text" name="fullName" value={formData.fullName} onChange={handleInputChange} required
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                          placeholder="Enter your full name" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address *</label>
                        <input type="email" name="email" value={formData.email} onChange={handleInputChange} required
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                          placeholder="your@email.com" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number *</label>
                        <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} required
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                          placeholder="+63 XXX XXX XXXX" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">License Number *</label>
                        <input type="text" name="licenseNumber" value={formData.licenseNumber} onChange={handleInputChange} required
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                          placeholder="Enter license number" />
                      </div>
                    </div>
                  </div>

                  {/* Rental Period */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                        <Clock className="w-4 h-4 text-white" />
                      </div>
                      Rental Period
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Pickup Date *</label>
                        <input type="date" name="pickupDate" value={formData.pickupDate} onChange={handleInputChange}
                          min={new Date().toISOString().split("T")[0]} required disabled={!selectedVariant}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all disabled:bg-gray-100 disabled:cursor-not-allowed" />
                        {!selectedVariant && <p className="text-xs text-amber-600 mt-1">Select a color first</p>}
                        {formData.pickupDate && isDateBooked(formData.pickupDate) && <p className="text-xs text-red-600 mt-1">This date is already booked</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Return Date *</label>
                        <input type="date" name="returnDate" value={formData.returnDate} onChange={handleInputChange}
                          min={formData.pickupDate || new Date().toISOString().split("T")[0]} required
                          disabled={!selectedVariant || !formData.pickupDate}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all disabled:bg-gray-100 disabled:cursor-not-allowed" />
                        {!formData.pickupDate && selectedVariant && <p className="text-xs text-amber-600 mt-1">Select pickup date first</p>}
                        {formData.returnDate && isDateBooked(formData.returnDate) && <p className="text-xs text-red-600 mt-1">This date is already booked</p>}
                      </div>
                    </div>
                    {bookedDates.length > 0 && selectedVariant && (
                      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-sm text-amber-800">
                          <strong>Note:</strong> Some dates are unavailable for this color. Choose available dates only.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Pickup or Delivery */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                        <MapPin className="w-4 h-4 text-white" />
                      </div>
                      Pickup or Delivery
                    </h3>
                    <p className="text-sm text-gray-500 mb-4 ml-11">
                      Choose how you'd like to receive the vehicle.
                    </p>

                    <div className="grid gap-3 md:grid-cols-2 mb-5">
                      <button
                        type="button"
                        onClick={() => setFormData(s => ({ ...s, deliveryOption: 'pickup', deliveryAddress: '' }))}
                        className={`p-4 rounded-xl border-2 transition-all text-left ${
                          formData.deliveryOption === 'pickup'
                            ? 'border-gray-900 bg-gray-50 shadow-sm'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                            formData.deliveryOption === 'pickup' ? 'border-gray-900' : 'border-gray-300'
                          }`}>
                            {formData.deliveryOption === 'pickup' && <div className="w-3 h-3 rounded-full bg-gray-900" />}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 flex items-center gap-2">
                              🏠 Self-Pickup
                            </div>
                            <div className="text-xs text-gray-500 mt-1 leading-relaxed">
                              Pick up the car at the owner's garage
                            </div>
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData(s => ({ ...s, deliveryOption: 'deliver', pickupLocation: '' }))}
                        className={`p-4 rounded-xl border-2 transition-all text-left ${
                          formData.deliveryOption === 'deliver'
                            ? 'border-gray-900 bg-gray-50 shadow-sm'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                            formData.deliveryOption === 'deliver' ? 'border-gray-900' : 'border-gray-300'
                          }`}>
                            {formData.deliveryOption === 'deliver' && <div className="w-3 h-3 rounded-full bg-gray-900" />}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 flex items-center gap-2">
                              🚗 Delivery
                            </div>
                            <div className="text-xs text-gray-500 mt-1 leading-relaxed">
                              We deliver the car to your address
                            </div>
                          </div>
                        </div>
                      </button>
                    </div>

                    {formData.deliveryOption === 'pickup' && (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zm0 16a2 2 0 002-2H8a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-amber-900 mb-1">
                            Pickup location will be sent after approval
                          </p>
                          <p className="text-sm text-amber-800 leading-relaxed">
                            The exact garage address of the vehicle owner will be shared with you once your booking is <strong>approved or confirmed</strong>. There's no need to enter a location at this stage.
                          </p>
                        </div>
                      </div>
                    )}

                    {formData.deliveryOption === 'deliver' && (
                      <div className="space-y-4">
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
                          <div className="flex-shrink-0 mt-0.5">
                            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-blue-900 mb-1">Delivery fee charged on arrival</p>
                            <p className="text-sm text-blue-800 leading-relaxed">
                              The fee is calculated based on the distance from the owner's garage to your address and will be charged when the vehicle is delivered to you.
                            </p>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Delivery Address *</label>
                          <textarea
                            name="deliveryAddress"
                            value={formData.deliveryAddress}
                            onChange={handleInputChange}
                            required
                            rows="3"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all resize-none"
                            placeholder="Enter your complete delivery address"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Identity Verification */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                        <CreditCard className="w-4 h-4 text-white" />
                      </div>
                      Identity Verification
                    </h3>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">Upload Driver's License *</label>
                      <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-gray-400 hover:bg-gray-50 transition-all duration-300">
                        <input type="file" accept="image/png,image/jpeg" onChange={handleFileChange} className="hidden" id="govId" />
                        <label htmlFor="govId" className="cursor-pointer block">
                          {govIdPreview ? (
                            <img src={govIdPreview} alt="ID Preview" className="mx-auto mb-3 max-h-32 rounded-lg object-contain shadow-md" />
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                              <Upload className="w-6 h-6 text-gray-600" />
                            </div>
                          )}
                          <p className="text-base font-medium text-gray-700 mb-1">{govIdPreview ? "Click to change" : "Click to upload"}</p>
                          <p className="text-sm text-gray-500">JPEG or PNG (Max 5MB)</p>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Pricing Summary + Submit */}
                  <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 shadow-lg text-white">
                    <h4 className="text-sm font-semibold text-gray-300 mb-3">Pricing Summary</h4>
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-300">Rental ({rentalDays} {rentalDays === 1 ? 'day' : 'days'})</span>
                        <span className="font-semibold">₱{basePrice.toLocaleString()}</span>
                      </div>
                      {displayCar?.deposit_amount && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-300">Security Deposit</span>
                          <span className="font-semibold text-amber-300">₱{Number(displayCar.deposit_amount).toLocaleString()}</span>
                        </div>
                      )}
                      {formData.deliveryOption === 'deliver' && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-300">Delivery Fee</span>
                          <span className="font-semibold text-blue-300">Charged when delivered</span>
                        </div>
                      )}
                    </div>
                    <div className="border-t border-gray-700 pt-3 mb-6">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-semibold">Rental Total</span>
                        <span className="text-3xl font-bold">₱{totalPrice.toLocaleString()}</span>
                      </div>
                      {displayCar?.deposit_amount && (
                        <p className="text-xs text-gray-400 mt-2">* Plus ₱{Number(displayCar.deposit_amount).toLocaleString()} refundable deposit</p>
                      )}
                      {formData.deliveryOption === 'deliver' && (
                        <p className="text-xs text-gray-400 mt-1">* Delivery fee will be added based on distance</p>
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={isSubmitting || !selectedVariant}
                      className={`w-full px-6 py-4 rounded-xl text-lg font-bold transition-all duration-300 transform
                        ${isSubmitting || !selectedVariant
                          ? "bg-gray-600 text-gray-300 cursor-not-allowed"
                          : "bg-white text-gray-900 hover:bg-gray-100 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                        }`}
                    >
                      {isSubmitting ? "Processing..." : "Confirm Booking"}
                    </button>
                  </div>

                </form>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contract Modal */}
      {contractModalVisible && (
        <div className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl p-8 relative max-h-[90vh] overflow-y-auto">
            <button type="button" onClick={handleContractClose}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center hover:bg-gray-200 transition-colors">
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-4 pr-2">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Rental Agreement</h3>
              <p className="text-sm text-gray-600">
                Please review and sign our rental damage responsibility agreement before submitting your booking.
              </p>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Rental Summary</h4>
                <p className="text-sm text-gray-700 mb-1">
                  <span className="font-medium">Vehicle:</span> {getVehicleSummary()}
                </p>
                <p className="text-sm text-gray-700 mb-1">
                  <span className="font-medium">Rental Period:</span>{" "}
                  {formatContractDate(formData.pickupDate)} – {formatContractDate(formData.returnDate)}
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Rental Total:</span> ₱{totalPrice.toLocaleString()}
                </p>
                {displayCar?.deposit_amount && (
                  <p className="text-sm text-amber-700 mt-2">
                    <span className="font-medium">Deposit:</span> ₱{Number(displayCar.deposit_amount).toLocaleString()} (Refundable)
                  </p>
                )}
                {formData.deliveryOption === 'pickup' && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800">
                      <span className="font-semibold">🏠 Self-Pickup:</span> The owner's garage address will be sent to you once your booking is approved or confirmed.
                    </p>
                  </div>
                )}
                {formData.deliveryOption === 'deliver' && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <span className="font-semibold">🚗 Delivery:</span> Delivery fee will be charged based on distance when the vehicle is delivered to you.
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h4 className="font-semibold text-gray-900 mb-3">Terms & Conditions</h4>
                <ul className="list-disc pl-5 text-sm text-gray-700 space-y-2">
                  <li>You accept full financial responsibility for any damage, loss, theft, or violations during your rental period.</li>
                  <li>You agree to notify The Rental Den immediately if an incident happens and to cooperate with any insurance requirements.</li>
                  <li>You agree to cover repair, downtime, and administrative costs that are not covered by insurance.</li>
                  {displayCar?.deposit_amount && (
                    <li>You understand that a security deposit of ₱{Number(displayCar.deposit_amount).toLocaleString()} will be collected and refunded after vehicle inspection.</li>
                  )}
                  {formData.deliveryOption === 'pickup' && (
                    <li>You understand that the pickup address (owner's garage) will be provided to you once your booking is approved or confirmed.</li>
                  )}
                  {formData.deliveryOption === 'deliver' && (
                    <li>You understand that the delivery fee will be calculated based on actual distance and charged when the vehicle is delivered.</li>
                  )}
                  <li>Typing your full name below serves as your legally binding digital signature.</li>
                </ul>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Type your full name to sign *
                </label>
                <input
                  type="text"
                  value={contractSignature}
                  onChange={(e) => setContractSignature(e.target.value)}
                  placeholder={formData.fullName || "Enter your full name"}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                />
                {contractError && <p className="text-sm text-red-600 mt-2">{contractError}</p>}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={handleContractClose}
                  className="px-6 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-all">
                  Review Form
                </button>
                <button type="button" onClick={handleContractConfirm} disabled={isSubmitting}
                  className={`px-6 py-3 rounded-xl text-white font-semibold transition-all ${
                    isSubmitting ? "bg-gray-400 cursor-not-allowed" : "bg-gray-900 hover:bg-gray-800"
                  }`}>
                  {isSubmitting ? "Processing..." : "Sign & Submit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
/* ===========================
   Modern Navbar with Firebase
   =========================== */
const Navbar = ({ onRentClick, scrollToSection, refs }) => {
  const [isOpen, setIsOpen] = useState(false)
    const navigate = useNavigate()   // ✅ ADD THIS

  const [active, setActive] = useState("home")
  const [scrolled, setScrolled] = useState(false)

  const handleScroll = (ref, name) => {
    scrollToSection(ref)
    setActive(name)
    setIsOpen(false)
  }

  // Track scroll for navbar background
  useEffect(() => {
    const handleScrollChange = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener("scroll", handleScrollChange)
    return () => window.removeEventListener("scroll", handleScrollChange)
  }, [])

  // Auto-update active state when scrolling
  useEffect(() => {
    const sections = [
      { name: "home", ref: refs.heroRef },
      { name: "about", ref: refs.aboutRef },
      { name: "cars", ref: refs.fleetRef },
      { name: "faqs", ref: refs.faqRef },
      { name: "gallery", ref: refs.galleryRef },
      { name: "contact", ref: refs.contactRef },
    ]

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const section = sections.find((s) => s.ref.current === entry.target)
            if (section) setActive(section.name)
          }
        })
      },
      { threshold: 0.5 }
    )

    sections.forEach((s) => {
      if (s.ref.current) observer.observe(s.ref.current)
    })

    return () => observer.disconnect()
  }, [refs])

  return (
    <nav 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled 
          ? "bg-white/95 backdrop-blur-md shadow-lg" 
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <div className="flex items-center flex-shrink-0 cursor-pointer transition-transform hover:scale-105">
            <img src={logo} alt="The Rental Den Logo" className="h-10 sm:h-12 w-auto mr-2" />
            <span className={`hidden sm:block text-lg font-bold transition-colors ${
              scrolled ? "text-gray-900" : "text-white"
            }`}>
              The Rental Den
            </span>
          </div>

          {/* Desktop Menu */}
          <div className="hidden lg:flex items-center space-x-8">
            {[
              { name: "home", label: "Home", ref: refs.heroRef },
              { name: "about", label: "About", ref: refs.aboutRef },
              { name: "cars", label: "Cars", ref: refs.fleetRef },
              { name: "faqs", label: "FAQs", ref: refs.faqRef },
              { name: "gallery", label: "Gallery", ref: refs.galleryRef },
              { name: "contact", label: "Contact", ref: refs.contactRef },
            ].map((item) => (
              <button
                key={item.name}
                onClick={() => handleScroll(item.ref, item.name)}
                className={`font-medium transition-all relative group ${
                  scrolled
                    ? active === item.name 
                      ? "text-black" 
                      : "text-gray-600 hover:text-black"
                    : active === item.name
                      ? "text-white font-semibold"
                      : "text-white/90 hover:text-white"
                }`}
              >
                {item.label}
                <span 
                  className={`absolute left-0 -bottom-1 h-0.5 bg-current transition-all ${
                    active === item.name ? "w-full" : "w-0 group-hover:w-full"
                  }`}
                />
              </button>
            ))}
          </div>

         {/* Rent Now Button - Desktop */}
          <div className="hidden lg:block">
            <button
              onClick={() => navigate('/calendar-booking')}
              className={`px-6 py-2.5 rounded-full font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-xl ${
                scrolled
                  ? "bg-black text-white hover:bg-gray-800"
                  : "bg-white text-black hover:bg-gray-100"
              }`}
            >
              Rent Now
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="lg:hidden">
            <button 
              onClick={() => setIsOpen(!isOpen)} 
              className={`p-2 rounded-md transition-colors ${
                scrolled ? "text-gray-700 hover:text-black" : "text-white hover:text-gray-200"
              }`}
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {isOpen && (
          <div className="lg:hidden pb-4 bg-white rounded-b-2xl shadow-xl">
            <div className="space-y-1 pt-2">
              {[
                { name: "home", label: "Home", ref: refs.heroRef },
                { name: "about", label: "About", ref: refs.aboutRef },
                { name: "cars", label: "Cars", ref: refs.fleetRef },
                { name: "faqs", label: "FAQs", ref: refs.faqRef },
                { name: "gallery", label: "Gallery", ref: refs.galleryRef },
                { name: "contact", label: "Contact", ref: refs.contactRef },
              ].map((item) => (
                <button
                  key={item.name}
                  onClick={() => handleScroll(item.ref, item.name)}
                  className={`block w-full text-left px-4 py-3 font-medium rounded-lg transition-colors ${
                    active === item.name 
                      ? "bg-black text-white" 
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {item.label}
                </button>
              ))}

              <button
                onClick={() => {
                  handleScroll(refs.fleetRef, "cars")
                  setIsOpen(false)
                }}
                className="w-full mt-4 bg-black text-white px-6 py-3 rounded-full font-semibold hover:bg-gray-800 transition-all"
              >
                Rent Now
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

/* ===========================
   Hero Section
   =========================== */
const HeroSection = ({ scrollToSection, refs }) => {
  const [loaded, setLoaded] = useState(false)
  const [vehicleCount, setVehicleCount] = useState(0)
  const [availableVehicleCount, setAvailableVehicleCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState(null)

  const [animatedHappyCustomers, setAnimatedHappyCustomers] = useState(0)
  const [animatedDailyBookings, setAnimatedDailyBookings] = useState(0)
  const [animatedVehicles, setAnimatedVehicles] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 100)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const data = await firebaseService.getWebsiteContent('about_us')
        if (!data) throw new Error('No data')
        setContent(data.content)
      } catch (err) {
        console.error('Error fetching about content:', err)
      }
    }
    fetchContent()
  }, [])

  useEffect(() => {
    const fetchVehicleStats = async () => {
      try {
        const vehicles = await firebaseService.listVehicles()
        const allVariants = await firebaseService.listAllVariants()
        const today = new Date().toISOString().split('T')[0]
        const allBookings = await firebaseService.listConfirmedBookings()
        const rentedVariantIds = new Set(
          allBookings
            .filter((b) => b.rental_end_date >= today && b.rental_start_date <= today)
            .map((b) => b.vehicle_variant_id)
        )
        const variantsByVehicle = {}
        allVariants?.forEach((v) => {
          if (!variantsByVehicle[v.vehicle_id]) variantsByVehicle[v.vehicle_id] = []
          variantsByVehicle[v.vehicle_id].push(v)
        })
        const totalVehicles = vehicles?.length || 0
        let availableCount = 0
        vehicles?.forEach((vehicle) => {
          const variants = variantsByVehicle[vehicle.id] || []
          const hasAvailable = variants.some(
            (v) => v.is_available !== false && !rentedVariantIds.has(v.id)
          )
          if (hasAvailable) availableCount++
        })
        setVehicleCount(totalVehicles)
        setAvailableVehicleCount(availableCount)
      } catch (error) {
        console.error('Error fetching vehicle stats:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchVehicleStats()
  }, [])

  useEffect(() => {
    if (!loaded || loading || !content) return

    const animateCount = (target, setter, duration = 2000) => {
      const increment = target / (duration / 16)
      let current = 0
      const timer = setInterval(() => {
        current += increment
        if (current >= target) {
          setter(target)
          clearInterval(timer)
        } else {
          setter(Math.floor(current))
        }
      }, 16)
      return timer
    }

    const t1 = animateCount(content.stats.happyCustomers, setAnimatedHappyCustomers)
    const t2 = setTimeout(() => animateCount(content.stats.dailyBookings, setAnimatedDailyBookings), 200)
    const t3 = setTimeout(() => animateCount(vehicleCount, setAnimatedVehicles), 400)

    return () => {
      clearInterval(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [loaded, loading, vehicleCount, content])

  return (
    <div className="relative h-[600px] sm:h-[700px] lg:h-[800px] bg-white overflow-hidden">

      {/* Background */}
      <div className="absolute inset-0 px-4 sm:px-6 lg:px-8 py-2 sm:py-3">
        <div
          className="relative w-full h-full bg-cover bg-center rounded-2xl sm:rounded-3xl overflow-hidden"
          style={{
            backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.1) 100%), url(${HeroBg})`,
            backgroundPosition: 'center 40%',
          }}
        >
          <div className="absolute inset-0">
            <div className="absolute top-10 left-10 w-20 h-20 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-10 right-10 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="absolute inset-0 z-20 flex items-center">
        <div className="max-w-7xl mx-auto px-8 sm:px-12 lg:px-16 w-full">
          <div
            className={`max-w-2xl transform transition-all duration-1000 ${
              loaded ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
            }`}
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full mb-6 border border-white/30">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-white text-sm font-medium">Premium Car Rental</span>
            </div>

            {/* Heading */}
            <h1 className="text-white text-4xl sm:text-5xl lg:text-7xl font-bold leading-tight mb-6">
              Find Your
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-300">
                Perfect Ride
              </span>
              <br />
              Today
            </h1>

            {/* Subheading */}
            <p className="text-gray-200 text-lg sm:text-xl lg:text-2xl mb-8 font-light">
              From Comfort to Luxury,
              <br />
              It's All in One Den
            </p>

            {/* ✅ CTA Buttons — fixed width, never full-width on mobile */}
            <div className="flex flex-row gap-4">
              <button
                onClick={() => scrollToSection(refs.fleetRef)}
                className="bg-white text-black px-8 py-4 rounded-full font-semibold hover:bg-gray-100 transition-all transform hover:scale-105 shadow-xl hover:shadow-2xl whitespace-nowrap"
              >
                Browse Fleet
              </button>
              <button
                onClick={() => scrollToSection(refs.aboutRef)}
                className="bg-transparent border-2 border-white text-white px-8 py-4 rounded-full font-semibold hover:bg-white hover:text-black transition-all transform hover:scale-105 whitespace-nowrap"
              >
                Learn More
              </button>
            </div>

            {/* Stats */}
            <div className="mt-12 flex gap-8">
              <div>
                <div className="text-3xl font-bold text-white">
                  {loading || !content ? '...' : `${animatedHappyCustomers}+`}
                </div>
                <div className="text-gray-300 text-sm">Happy Customers</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white">
                  {loading || !content ? '...' : `${animatedDailyBookings}+`}
                </div>
                <div className="text-gray-300 text-sm">Daily Bookings</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white">
                  {loading ? '...' : `${animatedVehicles}+`}
                </div>
                <div className="text-gray-300 text-sm">Total Vehicles</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 animate-bounce">
        <div className="w-6 h-10 border-2 border-white/50 rounded-full flex justify-center">
          <div className="w-1 h-3 bg-white rounded-full mt-2 animate-pulse" />
        </div>
      </div>
    </div>
  )
}

/* ===========================
   CLEAN About Section with Firebase
   =========================== */
const AboutSection = () => {
  const [ref, isVisible] = useScrollAnimation(0.2)
  const [content, setContent] = useState(null)
  
  // Fetch content from Firebase
  useEffect(() => {
    const fetchContent = async () => {
      try {
        const data = await firebaseService.getWebsiteContent('about_us');
        const error = !data;
        
        if (error) throw error;
        setContent(data.content);
      } catch (err) {
        console.error('Error fetching about content:', err);
      }
    };
    
    fetchContent();
  }, []);

  if (!content) return null;

  return (
    <section ref={ref} className="py-10 bg-white">
      <div className="max-w-7xl mx-auto mt-10 px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          
          {/* Image Side */}
          <div 
            className={`relative transition-all duration-1000 ${
              isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
          >
            {/* Subtle dark glow behind image */}
            <div className="absolute -inset-4 bg-gradient-to-br from-gray-900/20 via-black/10 to-gray-800/20 rounded-3xl blur-2xl"></div>
            
            <div className="relative">
              <img
                src={carabout}
                alt="The Rental Den - Premium Cars"
                className="relative w-full h-[450px] lg:h-[550px] object-cover rounded-3xl shadow-2xl"
              />
              
              {/* Minimal corner accents */}
              <div className="absolute top-4 left-4 w-12 h-12 border-l-2 border-t-2 border-white/30"></div>
              <div className="absolute top-4 right-4 w-12 h-12 border-r-2 border-t-2 border-white/30"></div>
              <div className="absolute bottom-4 left-4 w-12 h-12 border-l-2 border-b-2 border-white/30"></div>
              <div className="absolute bottom-4 right-4 w-12 h-12 border-r-2 border-b-2 border-white/30"></div>
            </div>
          </div>

          {/* Content Side */}
          <div 
            className={`transition-all duration-1000 delay-300 ${
              isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-20'
            }`}
          >
            {/* Section label */}
            <div className="inline-flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-full text-sm font-semibold mb-6">
              <div className="w-2 h-2 bg-white rounded-full"></div>
              About Us
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-6 leading-tight">
              {content.title}
            </h2>

            <p className="text-gray-600 text-base sm:text-lg leading-relaxed mb-8">
              {content.description}
            </p>

            {/* Key features */}
            <div className="space-y-4 mb-8">
              {[
                "Premium fleet of well-maintained vehicles",
                "Flexible rental periods and competitive pricing",
                "24/7 customer support and roadside assistance",
                "Easy booking process with instant confirmation"
              ].map((feature, idx) => (
                <div 
                  key={idx} 
                  className="flex items-start gap-3"
                  style={{
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? 'translateX(0)' : 'translateX(20px)',
                    transition: `all 0.5s ease ${0.5 + (idx * 0.1)}s`
                  }}
                >
                  <div className="w-6 h-6 bg-black rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-gray-700">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ===========================
   Why Choose Us Section with Firebase
   =========================== */
const WhyChooseUs = () => {
  const [titleRef, titleVisible] = useScrollAnimation()
  const [card1Ref, card1Visible] = useScrollAnimation()
  const [card2Ref, card2Visible] = useScrollAnimation()
  const [card3Ref, card3Visible] = useScrollAnimation()

  const features = [
    {
      icon: <img src={carIcon} alt="Car Icon" className="h-12 w-12 object-contain" />,
      title: "Quality Vehicles",
      description: "We maintain our fleet to the highest standards so you can enjoy a safe and smooth ride every time.",
    },
    {
      icon: <img src={calendarIcon} alt="Calendar Icon" className="h-12 w-12 object-contain" />,
      title: "Seamless Booking",
      description: "Simple, fast, and user-friendly. Book your car online in minutes, with instant confirmation.",
    },
    {
      icon: <img src={supportIcon} alt="Support Icon" className="h-12 w-12 object-contain" />,
      title: "Local Expertise",
      description: "Our Cebu-based team is here to help with travel tips, car pick-up, and customer support whenever you need it.",
    },
  ]

  const refs = [card1Ref, card2Ref, card3Ref]
  const visibles = [card1Visible, card2Visible, card3Visible]

  return (
    <section className="py-20 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-[0.02]">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, #000 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }}></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <div 
          ref={titleRef}
          className={`animate-on-scroll animate-fade-down ${titleVisible ? 'visible' : ''}`}
        >
          {/* Section label */}
          <div className="inline-flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-full text-sm font-semibold mb-6">
            <div className="w-2 h-2 bg-white rounded-full"></div>
            Why Choose Us
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
            Experience the Difference
          </h2>
          <p className="text-lg text-gray-600 mb-16 max-w-3xl mx-auto leading-relaxed">
            Enjoy a hassle-free ride with reliable cars, fast booking, and friendly support trusted by locals and tourists alike.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          {features.map((feature, index) => (
            <div
              key={index}
              ref={refs[index]}
              className={`group animate-on-scroll animate-fade-up delay-${(index + 1) * 100} ${visibles[index] ? 'visible' : ''}`}
            >
              {/* Clean modern card */}
              <div className="relative h-full">
                {/* Hover glow effect */}
                <div className="absolute -inset-1 bg-gradient-to-br from-gray-900 to-black rounded-3xl opacity-0 group-hover:opacity-5 blur-xl transition-all duration-500"></div>
                
                {/* Main card */}
                <div className="relative bg-white rounded-3xl p-10 shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-3 h-full border border-gray-100 overflow-hidden">
                  
                  {/* Icon container - clean modern design */}
                  <div className="relative mb-8 mx-auto w-24 h-24">
                    {/* Simple rings */}
                    <div className="absolute inset-0 border-2 border-gray-200 rounded-full group-hover:border-black transition-all duration-500"></div>
                    <div className="absolute inset-2 border border-gray-100 rounded-full"></div>
                    
                    {/* Icon center */}
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-black text-white rounded-full flex items-center justify-center shadow-xl group-hover:scale-110 transition-all duration-500 m-3">
                      {feature.icon}
                    </div>
                  </div>
                  
                  {/* Title */}
                  <h3 className="text-xl font-bold mb-4 text-gray-900">
                    {feature.title}
                  </h3>
                  
                  {/* Description */}
                  <p className="text-gray-600 leading-relaxed flex-grow">
                    {feature.description}
                  </p>

                  {/* Bottom accent */}
                  <div className="mt-8 pt-6 border-t border-gray-100">
                    <div className="w-16 h-1 bg-black rounded-full mx-auto group-hover:w-24 transition-all duration-500"></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}


/* ===========================
   How It Works Section - Redesigned with Carousel
   =========================== */
const HowItWorks = () => {
  const [titleRef, titleVisible] = useScrollAnimation()
  const [content, setContent] = useState(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const data = await firebaseService.getWebsiteContent('how_it_works');
        const error = !data;
        
        if (error) throw error;
        setContent(data.content);
      } catch (err) {
        console.error('Error fetching how it works content:', err);
      }
    };
    
    fetchContent();
  }, []);

  // Auto-play carousel
  useEffect(() => {
    if (!content || !isAutoPlaying || content.steps.length <= 3) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % content.steps.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [content, isAutoPlaying]);

  if (!content) return null;

  const showCarousel = content.steps.length > 3;
  const visibleSteps = showCarousel 
    ? [
        content.steps[currentIndex],
        content.steps[(currentIndex + 1) % content.steps.length],
        content.steps[(currentIndex + 2) % content.steps.length]
      ]
    : content.steps;

  const handlePrev = () => {
    setIsAutoPlaying(false);
    setCurrentIndex((prev) => (prev - 1 + content.steps.length) % content.steps.length);
  };

  const handleNext = () => {
    setIsAutoPlaying(false);
    setCurrentIndex((prev) => (prev + 1) % content.steps.length);
  };

  return (
    <section className="py-20 bg-gradient-to-br from-gray-900 via-black to-gray-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div 
          ref={titleRef}
          className={`text-center mb-16 animate-on-scroll animate-fade-down ${titleVisible ? 'visible' : ''}`}
        >
          <div className="inline-flex items-center gap-2 bg-white text-black px-5 py-2.5 rounded-full text-sm font-semibold mb-6">
            <div className="w-2 h-2 bg-black rounded-full animate-pulse"></div>
            How It Works
          </div>
          
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
            {content.title}
          </h2>
          
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Get behind the wheel in three simple steps
          </p>
        </div>

        {/* Steps Container */}
        <div className="relative">
          
          {/* Carousel Navigation - Only show if more than 3 steps */}
          {showCarousel && (
            <>
              <button
                onClick={handlePrev}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 lg:-translate-x-12 z-20 bg-white text-black p-3 rounded-full shadow-2xl hover:scale-110 transition-all duration-300 group"
                aria-label="Previous step"
              >
                <ChevronLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform duration-300" />
              </button>
              
              <button
                onClick={handleNext}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 lg:translate-x-12 z-20 bg-white text-black p-3 rounded-full shadow-2xl hover:scale-110 transition-all duration-300 group"
                aria-label="Next step"
              >
                <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform duration-300" />
              </button>
            </>
          )}

          {/* Steps Grid/Carousel */}
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {visibleSteps.map((step, idx) => (
              <div
                key={`${step.number}-${idx}`}
                className="relative group"
              >
                {/* Card with timeline design */}
                <div className="relative bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:border-white/30 transition-all duration-500 h-full overflow-hidden">
                  
                  {/* Glowing effect on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  
                  {/* Top accent bar */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-white via-gray-300 to-white transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-700"></div>

                  {/* Step number badge - timeline style */}
                  <div className="relative mb-8">
                    {/* Vertical line connector */}
                    <div className="absolute left-1/2 top-16 w-0.5 h-full bg-gradient-to-b from-white/30 to-transparent"></div>
                    
                    <div className="relative w-16 h-16 mx-auto">
                      {/* Pulsing rings */}
                      <div className="absolute inset-0 border-2 border-white/20 rounded-full animate-pulse"></div>
                      <div className="absolute inset-0 border border-white/10 rounded-full scale-125 group-hover:scale-150 transition-transform duration-700"></div>
                      
                      {/* Number badge */}
                      <div className="absolute inset-0 bg-white rounded-full flex items-center justify-center shadow-2xl transform group-hover:rotate-12 transition-all duration-500">
                        <span className="text-2xl font-bold bg-gradient-to-br from-gray-900 to-black bg-clip-text text-transparent">
                          {step.number}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="relative z-10 text-center">
                    <h3 className="text-xl font-bold text-white mb-4 group-hover:text-gray-100 transition-colors duration-300">
                      {step.title}
                    </h3>

                    <p className="text-gray-400 leading-relaxed mb-6 group-hover:text-gray-300 transition-colors duration-300">
                      {step.description}
                    </p>
                  </div>


                </div>
              </div>
            ))}
          </div>

          {/* Carousel Indicators */}
          {showCarousel && (
            <div className="flex justify-center gap-2 mt-8">
              {content.steps.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setIsAutoPlaying(false);
                    setCurrentIndex(idx);
                  }}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    idx === currentIndex 
                      ? 'w-8 bg-white' 
                      : 'w-2 bg-white/30 hover:bg-white/50'
                  }`}
                  aria-label={`Go to step ${idx + 1}`}
                ></button>
              ))}
            </div>
          )}
        </div>

        {/* CTA Section */}
        <div className="mt-16 text-center">
          <button 
            onClick={() => {
              const carsSection = document.getElementById('cars');
              if (carsSection) {
                carsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }}
            className="group relative bg-white text-black px-10 py-4 rounded-full font-semibold hover:bg-gray-100 transition-all transform hover:scale-105 shadow-2xl overflow-hidden"
          >
            <span className="relative z-10 flex items-center gap-2">
              Start Your Journey
              <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </span>
          </button>
          
          {showCarousel && (
            <p className="text-gray-400 text-sm mt-4">
              {content.steps.length} steps • Swipe or click arrows to explore
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

/* ===========================
   Improved CarCard Component - Compact & Modern
   =========================== */
// CarCard.jsx — React web component
const CarCard = ({ car, onRentClick, onOpenDetails, index }) => {
  const [colorStats, setColorStats] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cardRef, cardVisible] = useScrollAnimation()

  const isRentalDenVehicle = (vehicle) => {
    const ownerName = (vehicle.owner_name || '').toLowerCase().trim()
    return ownerName === 'rental den' ||
           ownerName === 'the rental den' ||
           ownerName.includes('rental den')
  }

  const isRentalDen = isRentalDenVehicle(car)

  useEffect(() => {
    const fetchVariantStats = async () => {
      if (!car?.id) return;
      setIsLoading(true);
      try {
        const variants = await firebaseService.listVariantsByVehicleId(car.id);
        const today = new Date().toISOString().split('T')[0];
        const allBookings = await firebaseService.listConfirmedBookings();
        const bookings = allBookings.filter(
          (b) => b.rental_end_date >= today && b.rental_start_date <= today
        );

        const colorGroups = {};
        variants.forEach(variant => {
          const colorKey = variant.color.toLowerCase().trim();
          if (!colorGroups[colorKey]) {
            colorGroups[colorKey] = { color: variant.color, total: 0, available: 0, rented: 0, unavailable: 0 };
          }
          colorGroups[colorKey].total++;
          if (!variant.is_available) {
            colorGroups[colorKey].unavailable++;
          } else {
            const isRented = bookings?.some(b => b.vehicle_variant_id === variant.id);
            if (isRented) colorGroups[colorKey].rented++;
            else          colorGroups[colorKey].available++;
          }
        });

        setColorStats(Object.values(colorGroups));
      } catch (error) {
        console.error("Error fetching variant stats:", error);
        setColorStats([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchVariantStats();
  }, [car?.id]);

  const getColorHex = (colorName) => {
    const name = colorName.toLowerCase();
    if (name.includes("white") || name.includes("pearl"))    return "#ffffff";
    if (name.includes("black") || name.includes("midnight")) return "#1f2937";
    if (name.includes("silver") || name.includes("metallic"))return "#9ca3af";
    if (name.includes("red"))    return "#dc2626";
    if (name.includes("blue"))   return "#2563eb";
    if (name.includes("gray") || name.includes("grey")) return "#6b7280";
    if (name.includes("green"))  return "#16a34a";
    if (name.includes("yellow") || name.includes("gold")) return "#facc15";
    if (name.includes("orange")) return "#f97316";
    if (name.includes("brown"))  return "#7c4a31";
    if (name.includes("beige"))  return "#e5decf";
    if (name.includes("purple")) return "#8b5cf6";
    if (name.includes("pink"))   return "#ec4899";
    return "#e5e7eb";
  };

  // ── Fuel meta helper ─────────────────────────────────────────────────────
  // Returns the accent color for the fuel chip based on fuel category.
  const getFuelColor = (fuelType) => {
    if (!fuelType) return "#f59e0b"
    const f = fuelType.toLowerCase()
    if (f.includes("electric"))                         return "#3b82f6"  // blue
    if (f.includes("hybrid") || f.includes("plug"))    return "#16a34a"  // green
    if (f.includes("diesel"))                           return "#0ea5e9"  // sky
    if (f.includes("cng") || f.includes("compressed")) return "#8b5cf6"  // purple
    if (f.includes("lpg") || f.includes("liquefied"))  return "#f97316"  // orange
    return "#f59e0b"                                                       // amber — gasoline
  }

  // ── Gas Pump SVG ─────────────────────────────────────────────────────────
  // A proper petrol-station pump silhouette. strokeColor is injected per fuel type.
  // Path anatomy:
  //   • Tall rectangle = tank body with pump face
  //   • Horizontal arm = nozzle arm extending right
  //   • Small square at arm end = nozzle head
  //   • Horizontal line inside tank = fuel-level indicator
  const GasPumpSVG = ({ strokeColor }) => (
    <svg
      width="14" height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke={strokeColor}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Main pump body */}
      <path d="M3 22V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16H3z" />
      {/* Nozzle arm */}
      <path d="M15 8h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3" />
      {/* Nozzle tip cap */}
      <rect x="19" y="10" width="2" height="3" rx="1" />
      {/* Fuel level indicator inside body */}
      <line x1="7" y1="14" x2="11" y2="14" />
      {/* Pump door / panel */}
      <rect x="5" y="7" width="8" height="5" rx="1" />
    </svg>
  )

  const isAvailable = colorStats.some(s => s.available > 0);
  const fuelColor   = getFuelColor(car.fuel_type)

  return (
    <div
      ref={cardRef}
      className={`relative w-full bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 overflow-hidden cursor-pointer group animate-on-scroll animate-fade-up delay-${(index % 6) * 100} ${cardVisible ? 'visible' : ''}`}
      onClick={() => onOpenDetails(car)}
    >
      {/* Hover glow */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-gray-900 via-black to-gray-900 rounded-2xl opacity-0 group-hover:opacity-10 blur-xl transition-all duration-500"></div>

      <div className="relative bg-white rounded-2xl overflow-hidden">

        {/* Image Section */}
        <div className="relative h-52 w-full overflow-hidden">
          <div className="absolute inset-0">
            <img src={defaultBackground} alt="Background" className="w-full h-full object-cover opacity-100" />
            <div className="absolute inset-0" style={{
              backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.03) 1px, transparent 1px),linear-gradient(to bottom, rgba(0,0,0,0.03) 1px, transparent 1px)`,
              backgroundSize: '20px 20px'
            }}></div>
          </div>

          {car.image_url ? (
            <img
              src={car.image_url}
              alt={`${car.make} ${car.model}`}
              loading="lazy"
              className="relative w-full h-full object-contain p-3 transition-transform duration-500 group-hover:scale-110 drop-shadow-lg"
            />
          ) : (
            <div className="relative w-full h-full flex items-center justify-center">
              <div className="text-center">
                <svg className="w-20 h-20 mx-auto mb-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm font-semibold text-gray-500">No Image Available</p>
              </div>
            </div>
          )}

          {/* Owner Badge */}
          <div className="absolute top-3 left-3">
            {isRentalDen ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg backdrop-blur-sm bg-white text-black border border-gray-200">
                <svg className="w-3.5 h-3.5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span>Rental Den</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg backdrop-blur-sm bg-gray-800 text-white border border-gray-700">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                </svg>
                <span>Partner</span>
              </div>
            )}
          </div>

          {/* Availability Badge */}
          {!isLoading && (
            <div className="absolute top-3 right-3">
              <div className={`px-3 py-1.5 rounded-full text-xs font-bold shadow-lg backdrop-blur-sm ${isAvailable ? 'bg-green-500/90 text-white' : 'bg-gray-900/90 text-white'}`}>
                {isAvailable ? 'Available' : 'Not Available'}
              </div>
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className="p-5">

          {/* Title */}
          <div className="mb-3">
            <h3 className="text-xl font-bold text-gray-900 truncate group-hover:text-black transition-colors">
              {car.model}
            </h3>
            <p className="text-xs text-gray-500 font-medium">{car.make} • {car.year}</p>
          </div>

          {/* Specs Row */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-black group-hover:text-white transition-colors">
                <IoSpeedometerOutline className="w-3.5 h-3.5" />
              </div>
              <span className="font-medium">{car.mileage ? `${Number(car.mileage).toLocaleString()}` : "N/A"}</span>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-black group-hover:text-white transition-colors">
                <IoPeopleOutline className="w-3.5 h-3.5" />
              </div>
              <span className="font-medium">{car.seats}</span>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-black group-hover:text-white transition-colors">
                <IoCarOutline className="w-3.5 h-3.5" />
              </div>
              <span className="font-medium text-xs">{car.type}</span>
            </div>

            {/* ── IMPROVED: Fuel Type chip with gas pump SVG ─────────── */}
            {car.fuel_type && (
              <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: fuelColor }}>
                {/*
                  Colored circle whose tint matches the fuel category:
                    Gasoline  → amber  (#f59e0b)
                    Electric  → blue   (#3b82f6)
                    Hybrid    → green  (#16a34a)
                    Diesel    → sky    (#0ea5e9)
                    CNG       → purple (#8b5cf6)
                    LPG       → orange (#f97316)
                */}
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                  style={{ backgroundColor: `${fuelColor}1a` }}   /* ~10% opacity tint */
                >
                  <GasPumpSVG strokeColor={fuelColor} />
                </div>
                <span>{car.fuel_type}</span>
              </div>
            )}
          </div>

          {/* Deposit Badge — unchanged from original */}
          {car.deposit_amount && (
            <div className="mb-4 p-2 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <p className="text-[10px] font-semibold text-amber-900 leading-tight">
                    ₱{Number(car.deposit_amount).toLocaleString()} Deposit
                  </p>
                  <p className="text-[9px] text-amber-700 leading-tight">Refundable</p>
                </div>
              </div>
            </div>
          )}

          {/* Price & Colors Row */}
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-black">₱{car.price_per_day}</span>
              <span className="text-xs text-gray-500 font-medium">/day</span>
            </div>

            {isLoading ? (
              <div className="flex gap-1.5">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="w-7 h-7 rounded-lg bg-gray-100 animate-pulse"></div>
                ))}
              </div>
            ) : colorStats.length > 0 ? (
              <div className="flex gap-1.5">
                {colorStats.slice(0, 3).map((stat, idx) => (
                  <div key={idx} className="relative group/color" title={`${stat.color} - ${stat.available} available`}>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-300 ${stat.available > 0 ? 'bg-gray-100 group-hover/color:scale-110' : 'bg-gray-50 opacity-40'}`}>
                      <div
                        className="w-4 h-4 rounded-full border shadow-sm"
                        style={{ backgroundColor: getColorHex(stat.color), borderColor: getColorHex(stat.color) === '#ffffff' ? '#e5e7eb' : getColorHex(stat.color) }}
                      />
                    </div>
                    {stat.available > 0 && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-black text-white text-[9px] rounded-full flex items-center justify-center font-bold border border-white">
                        {stat.available}
                      </div>
                    )}
                  </div>
                ))}
                {colorStats.length > 3 && (
                  <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-600">
                    +{colorStats.length - 3}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onRentClick(car) }}
              disabled={isLoading || !isAvailable}
              className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-sm transition-all duration-300 transform ${
                isLoading || !isAvailable
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-black text-white hover:bg-gray-900 hover:scale-105 shadow-lg hover:shadow-xl"
              }`}
            >
              {isLoading ? 'Loading...' : !isAvailable ? 'Unavailable' : 'Rent Now'}
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); onOpenDetails?.(car) }}
              className="flex-1 py-2.5 px-3 border-2 border-gray-200 text-sm rounded-xl font-bold hover:border-black hover:bg-gray-50 transition-all duration-300 transform hover:scale-105"
            >
              Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
/* ===========================
   Modern Fleet Section - Unique Filter UI
   =========================== */
const FleetSection = ({ onRentClick, onOpenDetails }) => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState(["All"]);
  const [vehicles, setVehicles] = useState([]);
  const [filteredVehicles, setFilteredVehicles] = useState([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [titleRef, titleVisible] = useScrollAnimation()
  const [carsRef, carsVisible] = useScrollAnimation()

  const fetchCategories = async () => {
    try {
      const vehicles = await firebaseService.listVehicles();
      const data = vehicles?.map((v) => ({ type: v.type })).filter((v) => v.type) || [];
      
      const uniqueTypes = [...new Set(data.map(vehicle => vehicle.type))];
      setCategories(["All", ...uniqueTypes]);
    } catch (err) {
      console.error("Error fetching categories:", err);
      setCategories(["All", "Sedan", "SUV", "Luxury"]);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      await fetchCategories();
      fetchVehicles();
    };
    fetchData();
  }, []);

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const data = await firebaseService.listVehicles();

      const enriched = (data || []).map((v) => {
        const variants = v.vehicle_variants || [];
        const totalAvailable = variants.reduce(
          (sum, vv) => sum + (vv.available_quantity || 0),
          0
        );
        return {
          ...v,
          available: totalAvailable > 0,
          available_quantity: totalAvailable,
          total_quantity: variants.length,
        };
      });

      setVehicles(enriched);
      setFilteredVehicles(enriched);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryClick = (category) => {
    setActiveCategory(category);
    setMenuOpen(false);
    if (category === "All") {
      setFilteredVehicles(vehicles);
    } else {
      setFilteredVehicles(vehicles.filter((v) => v.type === category));
    }
  };

  return (
    <section className="py-20 bg-gradient-to-b from-white via-gray-50 to-white relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-[0.02]">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, #000 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }}></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header Section */}
        <div 
          ref={titleRef}
          className={`text-center mb-16 animate-on-scroll animate-fade-down ${titleVisible ? 'visible' : ''}`}
        >
          <div className="inline-flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-full text-sm font-semibold mb-6">
            <div className="w-2 h-2 bg-white rounded-full"></div>
            Our Fleet
          </div>
          
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
            Explore Our Fleet
          </h2>
          
          <p className="text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed mb-12">
            Find the perfect car for your needs with our special rental offers.
            We provide a wide selection of vehicles, easy booking, and exceptional value.
          </p>

          {/* Unique Segmented Control Filter - Desktop */}
          <div className="hidden md:block max-w-3xl mx-auto">
            <div className="relative bg-white rounded-2xl p-2 shadow-lg border border-gray-200">
              <div className="grid grid-cols-auto gap-1" style={{ gridTemplateColumns: `repeat(${categories.length}, 1fr)` }}>
                {/* Animated background slider */}
                <div 
                  className="absolute top-2 h-[calc(100%-1rem)] bg-black rounded-xl transition-all duration-300 ease-out"
                  style={{
                    width: `calc(${100 / categories.length}% - 0.25rem)`,
                    left: `calc(${categories.indexOf(activeCategory) * (100 / categories.length)}% + 0.5rem)`,
                  }}
                ></div>
                
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => handleCategoryClick(cat)}
                    className={`relative z-10 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-300 ${
                      activeCategory === cat 
                        ? 'text-white' 
                        : 'text-gray-700 hover:text-gray-900'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile Segmented Control */}
          <div className="md:hidden">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-full flex items-center justify-between bg-white shadow-lg px-6 py-4 rounded-2xl border border-gray-200"
            >
              <span className="font-semibold text-gray-900">{activeCategory}</span>
              {menuOpen ? (
                <X className="w-5 h-5 text-gray-600" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-600" />
              )}
            </button>

            {menuOpen && (
              <div className="mt-3 bg-white shadow-xl rounded-2xl p-2 border border-gray-200">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => handleCategoryClick(cat)}
                    className={`block w-full text-left px-5 py-3 font-semibold rounded-xl transition-all ${
                      activeCategory === cat
                        ? "bg-black text-white"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col justify-center items-center py-20">
            <div className="w-16 h-16 border-4 border-gray-200 border-t-black rounded-full animate-spin mb-4"></div>
            <div className="text-lg text-gray-600 font-medium">Loading vehicles...</div>
          </div>
        ) : error ? (
          <div className="flex flex-col justify-center items-center py-20">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div className="text-lg text-red-600 font-medium">
              Error loading vehicles: {error}
            </div>
          </div>
        ) : filteredVehicles.length === 0 ? (
          <div className="flex flex-col justify-center items-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-lg text-gray-600 font-medium">
              No vehicles available in this category.
            </div>
          </div>
        ) : (
          <>
            {/* Vehicle Grid */}
            <div 
              ref={carsRef}
              className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-16 animate-on-scroll animate-fade-up ${carsVisible ? 'visible' : ''}`}
            >
              {filteredVehicles.slice(0, 6).map((vehicle, index) => (
                <CarCard
                  key={vehicle.id}
                  car={vehicle}
                  onRentClick={onRentClick}
                  onOpenDetails={onOpenDetails}
                  index={index}
                />
              ))}
            </div>

            {/* See More Button */}
            {filteredVehicles.length > 0 && (
              <div className="flex justify-center">
                <button
                  onClick={() => navigate('/cars')}
                  className="group relative bg-black text-white px-10 py-4 rounded-full font-bold text-base hover:bg-gray-900 transition-all duration-300 transform hover:scale-105 shadow-xl hover:shadow-2xl overflow-hidden"
                >
                  <span className="relative z-10 flex items-center gap-3">
                    See More Cars
                    <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-gray-800 to-black opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};



/* ===========================
   Clean & Modern FAQs Section with Subtle Automotive Touches
   =========================== */
const FAQs = () => {
  const [openIndex, setOpenIndex] = useState(null)
  const [titleRef, titleVisible] = useScrollAnimation()
  const [content, setContent] = useState(null)

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const data = await firebaseService.getWebsiteContent('faqs');
        const error = !data;
        
        if (error) throw error;
        setContent(data.content);
      } catch (err) {
        console.error('Error fetching FAQs content:', err);
      }
    };
    
    fetchContent();
  }, []);

  if (!content) return null;

  const toggleQuestion = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="py-20 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div 
          ref={titleRef}
          className={`text-center mb-12 animate-on-scroll animate-fade-down ${titleVisible ? 'visible' : ''}`}
        >
          <div className="inline-flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-full text-sm font-semibold mb-6">
            <div className="w-2 h-2 bg-white rounded-full"></div>
            FAQs
          </div>
          
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Frequently Asked Questions
          </h2>
          
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Find answers to common questions about our car rental service
          </p>
        </div>

        {/* Accordion List */}
        <div className="space-y-4">
          {content.questions.map((faq, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 hover:shadow-md"
            >
              {/* Question Button */}
              <button
                onClick={() => toggleQuestion(index)}
                className="w-full flex items-center justify-between p-6 text-left transition-colors duration-200 hover:bg-gray-50"
              >
                <div className="flex items-center gap-4 flex-1">
                  {/* Number Badge */}
                  <div className="flex-shrink-0 w-10 h-10 bg-black text-white rounded-full flex items-center justify-center font-bold text-lg">
                    {index + 1}
                  </div>
                  
                  {/* Question Text */}
                  <h3 className="text-lg font-semibold text-gray-900 pr-4">
                    {faq.question}
                  </h3>
                </div>

                {/* Toggle Icon */}
                <div className="flex-shrink-0">
                  <svg
                    className={`w-6 h-6 text-gray-600 transition-transform duration-300 ${
                      openIndex === index ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </button>

              {/* Answer - Expandable */}
              <div
                className={`overflow-hidden transition-all duration-300 ${
                  openIndex === index ? 'max-h-96' : 'max-h-0'
                }`}
              >
                <div className="px-6 pb-6 pt-2">
                  <div className="pl-14">
                    <div className="h-px bg-gray-200 mb-4"></div>
                    <p className="text-gray-700 leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Support Card */}
        <div className="mt-12 bg-gradient-to-br from-gray-900 to-black rounded-2xl p-8 text-white text-center">
          <div className="max-w-2xl mx-auto">
            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold mb-2">Still have questions?</h3>
            <p className="text-gray-300 mb-6">
              Our support team is here to help you 24/7
            </p>
            <button className="bg-white text-black px-8 py-3 rounded-full font-semibold hover:bg-gray-100 transition-all hover:scale-105 shadow-lg">
              Contact Us
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
  
 /* ===========================
   Gallery Section - IMPROVED with Unique Masonry Layout
   =========================== */
const GallerySection = () => {
  const [titleRef, titleVisible] = useScrollAnimation();
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const imagesPerPage = 9;

  useEffect(() => {
    const fetchGallery = async () => {
      try {
        const data = await firebaseService.listGalleryImages();
        const error = !data;
        
        if (error) throw error;
        setImages(data || []);
      } catch (err) {
        console.error('Error fetching gallery:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchGallery();
  }, []);

  const openLightbox = (image, index) => {
    setSelectedImage(image);
    setCurrentIndex(index);
  };

  const closeLightbox = () => {
    setSelectedImage(null);
  };

  const goToPrevious = () => {
    const newIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1;
    setCurrentIndex(newIndex);
    setSelectedImage(images[newIndex]);
  };

  const goToNext = () => {
    const newIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0;
    setCurrentIndex(newIndex);
    setSelectedImage(images[newIndex]);
  };

  const goToPreviousPage = () => {
    setCurrentPage((prev) => Math.max(0, prev - 1));
  };

  const goToNextPage = () => {
    const maxPage = Math.ceil(images.length / imagesPerPage) - 1;
    setCurrentPage((prev) => Math.min(maxPage, prev + 1));
  };

  const getCurrentImages = () => {
    const start = currentPage * imagesPerPage;
    const end = start + imagesPerPage;
    return images.slice(start, end);
  };

  const totalPages = Math.ceil(images.length / imagesPerPage);
  const hasMultiplePages = totalPages > 1;

  if (loading) return null;
  if (images.length === 0) return null;

  const currentImages = getCurrentImages();

  return (
    <>
      <section className="py-20 bg-gradient-to-b from-white via-gray-50 to-white relative overflow-hidden">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-[0.02]">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, #000 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div 
            ref={titleRef}
            className={`text-center mb-16 animate-on-scroll animate-fade-down ${titleVisible ? 'visible' : ''}`}
          >
            {/* Section label */}
            <div className="inline-flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-full text-sm font-semibold mb-6">
              <div className="w-2 h-2 bg-white rounded-full"></div>
              Gallery
            </div>

            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
              Our Gallery
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Take a look at our collection of vehicles and memorable moments with our satisfied customers.
            </p>
          </div>

          {/* Unique Masonry-style Gallery Grid */}
          <div className="relative">
            {/* Navigation Arrows */}
            {hasMultiplePages && currentPage > 0 && (
              <button
                onClick={goToPreviousPage}
                className="absolute -left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black hover:bg-gray-900 shadow-2xl flex items-center justify-center transition-all hover:scale-110 group"
                aria-label="Previous batch"
              >
                <svg className="w-6 h-6 text-white transform group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            {hasMultiplePages && currentPage < totalPages - 1 && (
              <button
                onClick={goToNextPage}
                className="absolute -right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black hover:bg-gray-900 shadow-2xl flex items-center justify-center transition-all hover:scale-110 group"
                aria-label="Next batch"
              >
                <svg className="w-6 h-6 text-white transform group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}

            {/* Uniform Grid - Same Size Images */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {currentImages.map((image, index) => {
                const globalIndex = currentPage * imagesPerPage + index;
                
                return (
                  <div
                    key={image.id}
                    className="group relative overflow-hidden rounded-2xl shadow-lg cursor-pointer transition-all duration-500 hover:shadow-2xl hover:-translate-y-2"
                    onClick={() => openLightbox(image, globalIndex)}
                  >
                    {/* Hover border effect */}
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-gray-900 to-black rounded-2xl opacity-0 group-hover:opacity-100 blur-sm transition-all duration-500"></div>
                    
                    <div className="relative h-full overflow-hidden rounded-2xl bg-gray-100">
                      {/* Fixed aspect ratio container */}
                      <div className="aspect-[4/3] overflow-hidden">
                        <img
                          src={image.image_url}
                          alt={image.title || 'Gallery image'}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                      </div>
                      
                      {/* Gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                          {image.title && (
                            <h3 className="text-lg font-bold mb-1 line-clamp-2">{image.title}</h3>
                          )}
                          {image.description && (
                            <p className="text-sm text-gray-200 line-clamp-2 mb-2">{image.description}</p>
                          )}
                          
                          {/* View icon */}
                          <div className="flex items-center gap-2 mt-3">
                            <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </div>
                            <span className="text-xs font-semibold">View Full Size</span>
                          </div>
                        </div>
                      </div>

                      {/* Corner accent */}
                      <div className="absolute top-3 right-3 w-10 h-10 border-t-2 border-r-2 border-white/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Page Indicators */}
            {hasMultiplePages && (
              <div className="flex justify-center items-center gap-3 mt-12">
                {Array.from({ length: totalPages }).map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentPage(index)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      index === currentPage 
                        ? 'bg-black w-8' 
                        : 'bg-gray-300 hover:bg-gray-400 w-2'
                    }`}
                    aria-label={`Go to page ${index + 1}`}
                  />
                ))}
                <span className="text-sm text-gray-500 ml-2 font-medium">
                  {currentPage + 1} / {totalPages}
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Enhanced Lightbox Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/95 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={closeLightbox}
        >
          {/* Close button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center text-white transition-all hover:scale-110 z-10 group"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Previous button */}
          <button
            onClick={(e) => { e.stopPropagation(); goToPrevious(); }}
            className="absolute left-4 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center text-white transition-all hover:scale-110 group"
          >
            <svg className="w-6 h-6 transform group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Next button */}
          <button
            onClick={(e) => { e.stopPropagation(); goToNext(); }}
            className="absolute right-4 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center text-white transition-all hover:scale-110 group"
          >
            <svg className="w-6 h-6 transform group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Image container */}
          <div className="max-w-6xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="relative rounded-2xl overflow-hidden shadow-2xl">
              <img
                src={selectedImage.image_url}
                alt={selectedImage.title || 'Gallery image'}
                className="w-full h-auto max-h-[80vh] object-contain"
              />
            </div>
            
            {/* Image info */}
            {(selectedImage.title || selectedImage.description || selectedImage.uploaded_date) && (
              <div className="mt-6 text-center text-white">
                {selectedImage.title && (
                  <h3 className="text-2xl font-bold mb-2">{selectedImage.title}</h3>
                )}
                {selectedImage.description && (
                  <p className="text-base text-gray-300 mb-3">{selectedImage.description}</p>
                )}
                <div className="flex items-center justify-center gap-4 text-sm text-gray-400">
                  <span>
                    {new Date(selectedImage.uploaded_date).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </span>
                  <span>•</span>
                  <span>
                    Image {currentIndex + 1} of {images.length}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Keyboard hint */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-6 text-white/60 text-xs">
            <span className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-white/10 rounded">←</kbd>
              Previous
            </span>
            <span className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-white/10 rounded">→</kbd>
              Next
            </span>
            <span className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-white/10 rounded">ESC</kbd>
              Close
            </span>
          </div>
        </div>
      )}
    </>
  );
};

/* ===========================
   Contact Us Section - FETCHES FROM SUPABASE
   =========================== */
const ContactUs = () => {
  const [titleRef, titleVisible] = useScrollAnimation()
  const [mapRef, mapVisible] = useScrollAnimation()
  const [detailsRef, detailsVisible] = useScrollAnimation()
  const [content, setContent] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const data = await firebaseService.getWebsiteContent('contact');
        const error = !data;
        
        if (error) throw error;
        setContent(data.content);
      } catch (err) {
        console.error('Error fetching contact content:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchContent();
  }, []);

  if (loading || !content) return null;

  const socialIcons = {
    facebook: FaFacebookF,
    instagram: FaInstagram,
    twitter: FaTwitter,
    linkedin: FaLinkedinIn,
  };

  const getIframeSrc = (iframe) => {
    const match = iframe.match(/src="([^"]+)"/);
    return match ? match[1] : "";
  };

  return (
    <section className="relative py-24 bg-gradient-to-b from-white via-gray-50 to-white overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-[0.02]">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, #000 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }}></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Title Section */}
        <div 
          ref={titleRef}
          className={`text-center mb-16 animate-on-scroll animate-fade-down ${titleVisible ? 'visible' : ''}`}
        >
          {/* Section label */}
          <div className="inline-flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-full text-sm font-semibold mb-6">
            <div className="w-2 h-2 bg-white rounded-full"></div>
            Contact Us
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
            {content.title}
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
            {content.subtitle}
          </p>
        </div>

        {/* Content Grid */}
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Left: Map */}
          <div 
            ref={mapRef}
            className={`group relative animate-on-scroll animate-fade-up delay-200 ${mapVisible ? 'visible' : ''}`}
          >
            {/* Hover glow effect */}
            <div className="absolute -inset-1 bg-gradient-to-br from-gray-900 to-black rounded-3xl opacity-0 group-hover:opacity-5 blur-xl transition-all duration-500"></div>
            
            {/* Map container */}
            <div className="relative bg-white rounded-3xl overflow-hidden shadow-xl border border-gray-100 group-hover:shadow-2xl transition-all duration-500">
              {/* Map frame decoration */}
              <div className="absolute top-4 left-4 w-12 h-12 border-l-2 border-t-2 border-black/10 rounded-tl-lg"></div>
              <div className="absolute top-4 right-4 w-12 h-12 border-r-2 border-t-2 border-black/10 rounded-tr-lg"></div>
              <div className="absolute bottom-4 left-4 w-12 h-12 border-l-2 border-b-2 border-black/10 rounded-bl-lg"></div>
              <div className="absolute bottom-4 right-4 w-12 h-12 border-r-2 border-b-2 border-black/10 rounded-br-lg"></div>

              <iframe
                src={getIframeSrc(content.map_embed)}
                width="100%"
                height="450"
                style={{ border: 0 }}
                loading="lazy"
                className="relative z-10"
              />
            </div>
          </div>

          {/* Right: Contact Details */}
          <div 
            ref={detailsRef}
            className={`animate-on-scroll animate-fade-up delay-300 ${detailsVisible ? 'visible' : ''}`}
          >
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              {content.details_title}
            </h3>
            <p className="text-gray-600 mb-8 leading-relaxed">
              {content.details_subtitle}
            </p>

            {/* Contact Info Cards */}
            <div className="grid sm:grid-cols-2 gap-4 mb-10">
              {/* Address */}
              <div className="group relative bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-100">
                <div className="absolute -inset-0.5 bg-gradient-to-br from-gray-900 to-black rounded-2xl opacity-0 group-hover:opacity-5 blur transition-all duration-300"></div>
                
                <div className="relative flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-gray-900 to-black rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <MapPin className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900 mb-1">Address</h4>
                    <p className="text-gray-600 text-sm leading-relaxed">{content.address}</p>
                  </div>
                </div>
              </div>

              {/* Mobile */}
              <div className="group relative bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-100">
                <div className="absolute -inset-0.5 bg-gradient-to-br from-gray-900 to-black rounded-2xl opacity-0 group-hover:opacity-5 blur transition-all duration-300"></div>
                
                <div className="relative flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-gray-900 to-black rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <Phone className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900 mb-1">Mobile</h4>
                    <p className="text-gray-600 text-sm">{content.mobile}</p>
                  </div>
                </div>
              </div>

              {/* Availability */}
              <div className="group relative bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-100">
                <div className="absolute -inset-0.5 bg-gradient-to-br from-gray-900 to-black rounded-2xl opacity-0 group-hover:opacity-5 blur transition-all duration-300"></div>
                
                <div className="relative flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-gray-900 to-black rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <Clock className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900 mb-1">Availability</h4>
                    <p className="text-gray-600 text-sm">{content.availability}</p>
                  </div>
                </div>
              </div>

              {/* Email */}
              <div className="group relative bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-100">
                <div className="absolute -inset-0.5 bg-gradient-to-br from-gray-900 to-black rounded-2xl opacity-0 group-hover:opacity-5 blur transition-all duration-300"></div>
                
                <div className="relative flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-gray-900 to-black rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <Mail className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900 mb-1">Email</h4>
                    <p className="text-gray-600 text-sm break-all">{content.email}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Social Media Section */}
            <div className="relative bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-100 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                  </svg>
                  Follow Us
                </h4>
                <div className="h-px flex-1 bg-gradient-to-r from-gray-200 to-transparent ml-4"></div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {content.social_media && content.social_media.map((social, index) => {
                  const IconComponent = socialIcons[social.icon] || FaFacebookF;
                  return (
                    <a
                      key={index}
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative w-11 h-11 bg-gradient-to-br from-gray-900 to-black rounded-xl flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 hover:scale-110"
                      title={social.platform}
                    >
                      <IconComponent size={18} className="text-white relative z-10" />
                      {/* Shine effect */}
                      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white to-transparent opacity-0 group-hover:opacity-20 rounded-xl transition-opacity duration-300"></div>
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
/* ===========================
   Footer
   =========================== */
const Footer = () => {
  return (
    <footer className="bg-[#101010] text-gray-300 py-12 px-6 md:px-10 lg:px-20">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10">
        
        {/* Contact Information */}
        <div>
          <h4 className="text-lg font-semibold mb-4">Contact Information</h4>
          <p className="mb-2">Cebu City, Philippines</p>
          <p className="mb-4">+63 900 000 0000</p>
          <div className="flex space-x-3">
            <a href="#" className="w-8 h-8 flex items-center justify-center rounded-md bg-gray-800 hover:bg-gray-700 transition">
              <FaFacebookF size={14} />
            </a>
            <a href="#" className="w-8 h-8 flex items-center justify-center rounded-md bg-gray-800 hover:bg-gray-700 transition">
              <FaInstagram size={14} />
            </a>
          </div>
        </div>
{/* Quick Links */}
<div>
          <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
          <ul className="space-y-2">
            <li><a href="#home" className="hover:text-white">Home</a></li>
            <li><a href="#about" className="hover:text-white">About Us</a></li>
            <li><a href="#cars" className="hover:text-white">Cars</a></li>
            <li><a href="#faqs" className="hover:text-white">FAQs</a></li>
            <li><a href="#gallery" className="hover:text-white">Gallery</a></li>
            <li><a href="#contact" className="hover:text-white">Contact</a></li>
          </ul>
        </div>
      </div>
      
      {/* Bottom Bar */}
      <div className="mt-10 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} The Rental Den. All Rights Reserved.
      </div>
    </footer>
  )
}

/* ===========================
   Main App
   =========================== */  
   const App = () => {
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedCar, setSelectedCar] = useState(null)
    const [bookings, setBookings] = useState([])
  
    // sections refs
    const heroRef = useRef(null)
    const aboutRef = useRef(null)
    const whyChooseUsRef = useRef(null)
    const fleetRef = useRef(null)
    const faqRef = useRef(null)
    const galleryRef = useRef(null)
    const contactRef = useRef(null)
    const FooterRef = useRef(null)
    const [isDetailsOpen, setIsDetailsOpen] = useState(false)
    const [isRentalOpen, setIsRentalOpen] = useState(false)
    const [selectedVariant, setSelectedVariant] = useState(null)
  
    const handleOpenDetails = (car) => {
      setSelectedCar(car)
      setSelectedVariant(null)
      setIsDetailsOpen(true)
    }
  
    const fetchBookings = async () => {
      const data = await firebaseService.listConfirmedBookings();
      setBookings(data || []);
    }
  
    useEffect(() => {
      fetchBookings()
    }, [])
  
    const handleRentClick = (car, variant = null) => {
      setSelectedCar(car)
      setSelectedVariant(variant)
      setIsDetailsOpen(false)
      setIsRentalOpen(true)
    }
  
    const handleCloseModal = () => {
      setIsModalOpen(false)
      setSelectedCar(null)
    }
  
    const scrollToSection = (ref) =>
      ref.current?.scrollIntoView({ behavior: "smooth" })
  
    return (
      <div className="min-h-screen bg-[#F0F5F8] flex flex-col">
        <Navbar
          onRentClick={() => handleRentClick()}
          scrollToSection={scrollToSection}
          refs={{
            heroRef,
            aboutRef,
            whyChooseUsRef,
            fleetRef,
            faqRef,
            galleryRef, 
            contactRef,
          }}
        />
  
       <div ref={heroRef} id="home">
        <HeroSection
          scrollToSection={scrollToSection}
          refs={{
            heroRef,
            aboutRef,
            fleetRef,
          }}
        />
      </div>
        
        <div ref={aboutRef} id="about">
          <AboutSection />
          <div ref={whyChooseUsRef}>
            <WhyChooseUs />
          </div>
        </div>
        
        <HowItWorks />
        
        <div ref={fleetRef} id="cars">
          <FleetSection
            onOpenDetails={handleOpenDetails}
            onRentClick={handleRentClick}
          />
        </div>
  
        <DetailsModal
          isOpen={isDetailsOpen}
          onClose={() => setIsDetailsOpen(false)}
          car={selectedCar}
          onRentClick={handleRentClick}
        />
        <RentalBot />
  
        <RentalModal
          isOpen={isRentalOpen}
          onClose={() => setIsRentalOpen(false)}
          selectedCar={selectedCar}
          selectedVariant={selectedVariant}
        />
  
        <div ref={faqRef} id="faqs">
          <FAQs />
        </div>
  
        <div ref={galleryRef} id="gallery">
          <GallerySection />
        </div>
  
        <div ref={contactRef} id="contact">
          <ContactUs />
        </div>
  
        <div ref={FooterRef}>
          <Footer />
        </div>
  
        <style>{`
          @keyframes slide-in {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
          .animate-slide-in { animation: slide-in 0.3s ease-out; }
          
          @keyframes fade-up {
            from {
              opacity: 0;
              transform: translateY(60px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          @keyframes fade-down {
            from {
              opacity: 0;
              transform: translateY(-60px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          @keyframes fade-left {
            from {
              opacity: 0;
              transform: translateX(-60px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
          
          @keyframes fade-right {
            from {
              opacity: 0;
              transform: translateX(60px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
          
          .animate-on-scroll:not(.visible) {
            opacity: 0;
            transform: translateY(60px);
          }
          
          .animate-on-scroll.visible {
            animation-duration: 0.8s;
            animation-fill-mode: both;
            animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
          }
          
          .animate-fade-up.visible {
            animation-name: fade-up;
          }
          
          .animate-fade-down.visible {
            animation-name: fade-down;
          }
          
          .animate-fade-left.visible {
            animation-name: fade-left;
          }
          
          .animate-fade-right.visible {
            animation-name: fade-right;
          }
          
          .delay-100 { animation-delay: 0.1s; }
          .delay-200 { animation-delay: 0.2s; }
          .delay-300 { animation-delay: 0.3s; }
          .delay-400 { animation-delay: 0.4s; }
          .delay-500 { animation-delay: 0.5s; }
        `}</style>
      </div>
    )
  }
  
  export default App