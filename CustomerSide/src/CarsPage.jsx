import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import {
  X,
  ChevronDown,
  Menu,
  Calendar,
  User,
  Clock,
  CreditCard,
  Upload,
  CheckCircle,
  AlertCircle,
  MapPin,
  Phone,
  Mail,
} from "lucide-react"
import { IoSpeedometerOutline, IoPeopleOutline, IoCarOutline } from "react-icons/io5"
import { FaFacebookF, FaInstagram } from "react-icons/fa"
import * as firebaseService from "./lib/firebaseService"
import defaultBackground from "./assets/CarScreen/defaultBg.png"
import logo from "./assets/logo/logoRental.png"
import Carpage from "./assets/Carpage.png"

/* ===========================
   Intersection Observer Hook
   =========================== */
const useScrollAnimation = () => {
  const [ref, setRef] = useState(null)
  const [isVisible, setIsVisible] = useState(false)
  const [hasAnimated, setHasAnimated] = useState(false)

  useEffect(() => {
    if (!ref) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setIsVisible(true)
          setHasAnimated(true)
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -100px 0px" }
    )
    observer.observe(ref)
    return () => observer.disconnect()
  }, [ref, hasAnimated])

  return [setRef, isVisible]
}

/* ===========================
   Toast Component
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
        {type === "success" ? (
          <CheckCircle className="h-5 w-5 mr-3" />
        ) : (
          <AlertCircle className="h-5 w-5 mr-3" />
        )}
        <span className="text-sm font-medium">{message}</span>
        <button onClick={onClose} className="ml-4 text-gray-400 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

/* ===========================
   Navbar — matches App.jsx exactly
   =========================== */
const Navbar = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScrollChange = () => setScrolled(window.scrollY > 50)
    window.addEventListener("scroll", handleScrollChange)
    return () => window.removeEventListener("scroll", handleScrollChange)
  }, [])

  const navItems = [
    { label: "Home",    path: "/" },
    { label: "About",   path: "/#about" },
    { label: "Cars",    path: "/cars" },
    { label: "FAQs",    path: "/#faqs" },
    { label: "Gallery", path: "/#gallery" },
    { label: "Contact", path: "/#contact" },
  ]

  const handleNavClick = (path) => {
    setIsOpen(false)
    if (path.includes("#")) {
      const section = path.split("#")[1]
      navigate("/")
      setTimeout(() => {
        document.getElementById(section)?.scrollIntoView({ behavior: "smooth" })
      }, 100)
    } else {
      navigate(path)
    }
  }

  const isActive = (path) => path === "/cars" && location.pathname === "/cars"

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/95 backdrop-blur-md shadow-lg"
          : "bg-white/95 backdrop-blur-md shadow-sm"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">

          {/* Logo */}
          <div
            className="flex items-center flex-shrink-0 cursor-pointer transition-transform hover:scale-105"
            onClick={() => navigate("/")}
          >
            <img src={logo} alt="The Rental Den Logo" className="h-10 sm:h-12 w-auto mr-2" />
            <span className="hidden sm:block text-lg font-bold text-gray-900">
              The Rental Den
            </span>
          </div>

          {/* Desktop Links */}
          <div className="hidden lg:flex items-center space-x-8">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => handleNavClick(item.path)}
                className={`font-medium transition-all relative group ${
                  isActive(item.path) ? "text-black" : "text-gray-600 hover:text-black"
                }`}
              >
                {item.label}
                <span
                  className={`absolute left-0 -bottom-1 h-0.5 bg-current transition-all ${
                    isActive(item.path) ? "w-full" : "w-0 group-hover:w-full"
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Rent Now — Desktop */}
          <div className="hidden lg:block">
            <button
              onClick={() => navigate("/calendar-booking")}
              className="px-6 py-2.5 rounded-full font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-xl bg-black text-white hover:bg-gray-800"
            >
              Rent Now
            </button>
          </div>

          {/* Mobile hamburger */}
          <div className="lg:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-md text-gray-700 hover:text-black transition-colors"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {isOpen && (
          <div className="lg:hidden pb-4 bg-white rounded-b-2xl shadow-xl">
            <div className="space-y-1 pt-2">
              {navItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => handleNavClick(item.path)}
                  className={`block w-full text-left px-4 py-3 font-medium rounded-lg transition-colors ${
                    isActive(item.path)
                      ? "bg-black text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {item.label}
                </button>
              ))}
              <div className="px-4 pt-2">
                <button
                  onClick={() => { navigate("/calendar-booking"); setIsOpen(false) }}
                  className="w-full bg-black text-white px-6 py-3 rounded-full font-semibold hover:bg-gray-800 transition-all"
                >
                  Rent Now
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

/* ===========================
   Details Modal
   =========================== */
const DetailsModal = ({ isOpen, onClose, car, onRentClick }) => {
  const [variants, setVariants] = useState([])
  const [selectedVariant, setSelectedVariant] = useState(null)
  const [variantStats, setVariantStats] = useState({})
  const [colorGroups, setColorGroups] = useState([])

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "auto"
    return () => { document.body.style.overflow = "auto" }
  }, [isOpen])

  useEffect(() => {
    const fetchVariants = async () => {
      if (!car?.id) return
      const variantsData = await firebaseService.listVariantsByVehicleId(car.id)
      const today = new Date().toISOString().split("T")[0]
      const allBookings = await firebaseService.listConfirmedBookings()
      const bookings = allBookings.filter(
        (b) => b.status === "confirmed" && b.rental_end_date >= today && b.rental_start_date <= today
      )
      const stats = {}
      variantsData.forEach((variant) => {
        const isRented = bookings?.some((b) => b.vehicle_variant_id === variant.id)
        stats[variant.id] = {
          isAvailable: variant.is_available && !isRented,
          isRented,
          isMaintenance: !variant.is_available,
        }
      })
      const groups = {}
      variantsData.forEach((variant) => {
        const colorKey = variant.color.toLowerCase().trim()
        if (!groups[colorKey]) groups[colorKey] = { color: variant.color, variants: [] }
        groups[colorKey].variants.push(variant)
      })
      setVariants(variantsData || [])
      setVariantStats(stats)
      setColorGroups(Object.values(groups))
      const firstAvailable = variantsData.find((v) => stats[v.id]?.isAvailable)
      setSelectedVariant(firstAvailable || variantsData[0])
    }
    if (isOpen) fetchVariants()
  }, [isOpen, car])

  if (!isOpen || !car) return null

  const getColorHex = (colorName) => {
    const n = colorName.toLowerCase()
    if (n.includes("white") || n.includes("pearl")) return "#ffffff"
    if (n.includes("black") || n.includes("midnight")) return "#1f2937"
    if (n.includes("silver") || n.includes("metallic")) return "#9ca3af"
    if (n.includes("red")) return "#dc2626"
    if (n.includes("blue")) return "#2563eb"
    if (n.includes("gray") || n.includes("grey")) return "#6b7280"
    if (n.includes("green")) return "#16a34a"
    if (n.includes("yellow") || n.includes("gold")) return "#facc15"
    if (n.includes("orange")) return "#f97316"
    if (n.includes("brown")) return "#7c4a31"
    if (n.includes("purple")) return "#8b5cf6"
    if (n.includes("pink")) return "#ec4899"
    if (n.includes("beige")) return "#e5decf"
    return "#e5e7eb"
  }

  const renderColorSwatch = (colorGroup) => {
    const bgColor = getColorHex(colorGroup.color)
    const availableCount = colorGroup.variants.filter((v) => variantStats[v.id]?.isAvailable).length
    const totalCount = colorGroup.variants.length
    const hasAvailable = availableCount > 0
    const isSelected = colorGroup.variants.some((v) => v.id === selectedVariant?.id)

    return (
      <button
        key={colorGroup.color}
        onClick={() => {
          const first = colorGroup.variants.find((v) => variantStats[v.id]?.isAvailable)
          setSelectedVariant(first || colorGroup.variants[0])
        }}
        disabled={!hasAvailable}
        className={`relative p-2 rounded-lg border-2 transition-all duration-200 ${
          isSelected
            ? "border-black bg-gray-50 shadow-md"
            : hasAvailable
            ? "border-gray-200 hover:border-gray-400 bg-white"
            : "border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed"
        }`}
      >
        <div className="flex flex-col items-center gap-1">
          <div className="relative">
            <div
              className={`w-10 h-10 rounded-full ${isSelected ? "ring-2 ring-black ring-offset-1" : ""}`}
              style={{ backgroundColor: bgColor, border: bgColor === "#ffffff" ? "2px solid #e5e7eb" : "none" }}
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
            <div className={`text-xs font-semibold ${isSelected ? "text-black" : "text-gray-700"}`}>
              {colorGroup.color}
            </div>
            <div className="text-[10px] text-gray-500">{availableCount}/{totalCount}</div>
          </div>
        </div>
      </button>
    )
  }

  const stats = variantStats[selectedVariant?.id] || {}

  return (
    <div className="fixed inset-0 bg-white z-[9999] flex flex-col">
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="text-2xl font-bold text-gray-900">Vehicle Details</div>
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all">
          <X className="w-5 h-5 text-gray-900" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="grid lg:grid-cols-2 gap-0">
          <div className="relative bg-white p-8 flex items-center justify-center min-h-[400px]">
            <div className="absolute inset-0">
              <img src={defaultBackground} alt="Background" className="w-full h-full object-cover" />
            </div>
            <div className="relative z-10 w-full max-w-2xl">
              <img
                src={selectedVariant?.image_url || car.image_url || defaultBackground}
                alt={`${car.make} ${car.model}`}
                className="w-full h-auto object-contain drop-shadow-2xl"
              />
            </div>
          </div>

          <div className="p-6 lg:p-8 bg-gray-50">
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <h1 className="text-2xl font-bold text-gray-900">{car.make} {car.model}</h1>
                <p className="text-sm text-gray-500 mt-1">{car.year}</p>
              </div>

              <div className="bg-black text-white rounded-xl p-4">
                <div className="text-xs text-gray-300 mb-1">Daily Rental Rate</div>
                <div className="text-3xl font-bold">
                  ₱{(selectedVariant?.price_per_day || car.price_per_day)?.toLocaleString()}
                  <span className="text-base font-normal text-gray-400 ml-2">/day</span>
                </div>
              </div>

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
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <h3 className="text-base font-bold text-gray-900 mb-2">Description</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {car.description || "Experience luxury and performance with this premium vehicle. Perfect for business trips, special occasions, or when you simply want to enjoy the finest driving experience."}
                </p>
              </div>

              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <h3 className="text-base font-bold text-gray-900 mb-3">Available Colors</h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {colorGroups.map(renderColorSwatch)}
                </div>
              </div>

              {selectedVariant && (
                <div className={`rounded-xl p-4 border-2 ${
                  stats.isAvailable ? "bg-green-50 border-green-200" :
                  stats.isRented ? "bg-orange-50 border-orange-200" :
                  "bg-red-50 border-red-200"
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
                      stats.isAvailable ? "bg-green-600 text-white" :
                      stats.isRented ? "bg-orange-600 text-white" :
                      "bg-red-600 text-white"
                    }`}>
                      {stats.isAvailable ? "✓ Available" : stats.isRented ? "Rented" : "Maintenance"}
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  if (!stats.isAvailable) {
                    alert(stats.isRented
                      ? "This color is currently rented. Please select another color or check back later."
                      : "This vehicle is under maintenance. Please select another color.")
                    return
                  }
                  onClose()
                  onRentClick(car, selectedVariant)
                }}
                disabled={!stats.isAvailable}
                className={`w-full py-3 rounded-xl text-base font-bold transition-all ${
                  stats.isAvailable
                    ? "bg-black text-white hover:bg-gray-800"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
              >
                {stats.isAvailable ? "Book This Vehicle" : stats.isRented ? "Currently Rented" : "Unavailable"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

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
            groups[colorKey] = {
              color: variant.color,
              variants: []
            }
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
        // No delivery fee added to total - will be charged when delivered
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
    const parts = [
      selectedCar?.year,
      selectedCar?.make,
      selectedCar?.model,
    ].filter(Boolean)
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
    if (!formData.vehicleVariantId) {
      return "Please select a color variant."
    }
    if (!govIdFile) {
      return "Please upload a valid Driver's License Card image."
    }
    if (!formData.pickupDate || !formData.returnDate) {
      return "Please set a valid rental date range."
    }
    if (formData.deliveryOption === 'pickup' && !formData.pickupLocation) {
      return "Please enter a pickup location."
    }
    if (formData.deliveryOption === 'deliver' && !formData.deliveryAddress) {
      return "Please enter a delivery address."
    }

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
    if (!allowed.includes(file.type)) {
      showToast("error", "Only JPG/PNG images allowed.")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast("error", "File size must be under 5MB")
      return
    }
    setGovIdFile(file)
    setGovIdPreview(URL.createObjectURL(file))
  }

  const isDateBooked = (dateString) => {
    return bookedDates.includes(dateString)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (isSubmitting) return
    const validationError = validateBookingForm()
    if (validationError) {
      showToast("error", validationError)
      return
    }
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
        pickup_location: formData.deliveryOption === 'pickup' ? formData.pickupLocation : formData.deliveryAddress,
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
          pickup_location: formData.deliveryOption === 'pickup' ? formData.pickupLocation : formData.deliveryAddress,
          delivery_option: formData.deliveryOption,
          total_price: totalPrice,
          contractText: contractDetails?.text,
          contractSignedName: contractDetails?.signedName,
          contractSignedAt: contractDetails?.signedAt,
          contractVehicleSummary: getVehicleSummary(),
        }

        const emailResponse = await fetch('http://localhost:3001/api/send-booking-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
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
    if (validationError) {
      showToast("error", validationError)
      setContractError(validationError)
      return
    }

    if (!contractSignature.trim()) {
      setContractError("Please type your full name to sign the contract.")
      return
    }

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
    const colorName = colorGroup.color.toLowerCase()
    let bgColor = getColorHex(colorGroup.color)
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
    make: 'Toyota',
    model: 'Camry',
    year: 2024,
    seats: 5,
    price_per_day: 3500,
    image_url: defaultBackground
  }

  const basePrice = rentalDays * (selectedVariant?.price_per_day || displayCar?.price_per_day || 0)

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

          {/* Main Content - SINGLE SCROLL */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid lg:grid-cols-5 gap-0">
              
              {/* Left Side - Vehicle Display (2 cols) */}
              <div className="lg:col-span-2 bg-gradient-to-br from-gray-50 to-white p-6">
                <div className="max-w-md mx-auto space-y-6">
                  
                  {/* Vehicle Image */}
                  <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl border border-gray-200">
                    <img
                      src={defaultBackground}
                      className="absolute inset-0 w-full h-full object-cover"
                      alt="Background"
                    />
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

                  {/* Vehicle Info */}
                  <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
                    <h3 className="text-2xl font-bold text-gray-900 mb-3">
                      {displayCar?.make} {displayCar?.model}
                    </h3>
                    
                    <div className="flex items-center gap-3 mb-4 flex-wrap">
                      <span className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full text-sm font-medium">
                        <Calendar className="w-4 h-4" />
                        {displayCar?.year}
                      </span>
                      <span className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full text-sm font-medium">
                        <IoPeopleOutline className="w-4 h-4" />
                        {displayCar?.seats} seats
                      </span>
                    </div>

                    <div className="border-t border-gray-200 pt-4 mb-4">
                      <div className="text-3xl font-bold text-gray-900">
                        ₱{(selectedVariant?.price_per_day || displayCar?.price_per_day)?.toLocaleString()}
                        <span className="text-base font-normal text-gray-600 ml-2">/day</span>
                      </div>
                    </div>

                    {/* Color Selection */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">
                        Select Color
                      </label>
                      <div className="flex flex-wrap gap-3 mb-3">
                        {colorGroups.map(renderColorGroupSwatch)}
                      </div>
                      {selectedVariant && (
                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                          <p className="text-sm text-gray-600">
                            <span className="font-semibold text-gray-900">{selectedVariant.color}</span>
                            {colorGroups.length > 0 && (
                              <span className="ml-2">
                                ({colorGroups.find(g => 
                                  g.variants.some(v => v.id === selectedVariant.id)
                                )?.variants.filter(v => v.is_available).length || 0} available)
                              </span>
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side - Form + Pricing (3 cols) */}
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
                        <input
                          type="text"
                          name="fullName"
                          value={formData.fullName}
                          onChange={handleInputChange}
                          required
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                          placeholder="Enter your full name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address *</label>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          required
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                          placeholder="your@email.com"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number *</label>
                        <input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleInputChange}
                          required
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                          placeholder="+63 XXX XXX XXXX"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">License Number *</label>
                        <input
                          type="text"
                          name="licenseNumber"
                          value={formData.licenseNumber}
                          onChange={handleInputChange}
                          required
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                          placeholder="Enter license number"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Rental Details */}
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
                        <input
                          type="date"
                          name="pickupDate"
                          value={formData.pickupDate}
                          onChange={handleInputChange}
                          min={new Date().toISOString().split("T")[0]}
                          required
                          disabled={!selectedVariant}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                        {!selectedVariant && (
                          <p className="text-xs text-amber-600 mt-1">Select a color first</p>
                        )}
                        {formData.pickupDate && isDateBooked(formData.pickupDate) && (
                          <p className="text-xs text-red-600 mt-1">This date is already booked</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Return Date *</label>
                        <input
                          type="date"
                          name="returnDate"
                          value={formData.returnDate}
                          onChange={handleInputChange}
                          min={formData.pickupDate || new Date().toISOString().split("T")[0]}
                          required
                          disabled={!selectedVariant || !formData.pickupDate}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                        {!formData.pickupDate && selectedVariant && (
                          <p className="text-xs text-amber-600 mt-1">Select pickup date first</p>
                        )}
                        {formData.returnDate && isDateBooked(formData.returnDate) && (
                          <p className="text-xs text-red-600 mt-1">This date is already booked</p>
                        )}
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

                  {/* Pickup/Delivery Options */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                        <MapPin className="w-4 h-4 text-white" />
                      </div>
                      Pickup or Delivery
                    </h3>
                    
                    <div className="grid gap-3 md:grid-cols-2 mb-4">
                      <button
                        type="button"
                        onClick={() => setFormData(s => ({ ...s, deliveryOption: 'pickup', deliveryAddress: '' }))}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          formData.deliveryOption === 'pickup'
                            ? 'border-gray-900 bg-gray-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            formData.deliveryOption === 'pickup' ? 'border-gray-900' : 'border-gray-300'
                          }`}>
                            {formData.deliveryOption === 'pickup' && (
                              <div className="w-3 h-3 rounded-full bg-gray-900"></div>
                            )}
                          </div>
                          <div className="text-left">
                            <div className="font-semibold text-gray-900">Pickup</div>
                            <div className="text-xs text-gray-600">Pick up at location</div>
                          </div>
                        </div>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => setFormData(s => ({ ...s, deliveryOption: 'deliver', pickupLocation: '' }))}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          formData.deliveryOption === 'deliver'
                            ? 'border-gray-900 bg-gray-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            formData.deliveryOption === 'deliver' ? 'border-gray-900' : 'border-gray-300'
                          }`}>
                            {formData.deliveryOption === 'deliver' && (
                              <div className="w-3 h-3 rounded-full bg-gray-900"></div>
                            )}
                          </div>
                          <div className="text-left">
                            <div className="font-semibold text-gray-900">Delivery</div>
                            <div className="text-xs text-gray-600">We deliver to you</div>
                          </div>
                        </div>
                      </button>
                    </div>

                    {/* Delivery Fee Note */}
                    {formData.deliveryOption === 'deliver' && (
                      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-blue-900 mb-1">
                            📍 Delivery Fee Information
                          </p>
                          <p className="text-sm text-blue-800">
                            Delivery fee will be calculated based on the distance (kilometers) from our location to your delivery address. 
                            The exact fee will be determined and charged when the vehicle is delivered to you.
                          </p>
                        </div>
                      </div>
                    )}

                    {formData.deliveryOption === 'pickup' && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Pickup Location *</label>
                        <input
                          type="text"
                          name="pickupLocation"
                          value={formData.pickupLocation}
                          onChange={handleInputChange}
                          required
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                          placeholder="Enter pickup location"
                        />
                      </div>
                    )}

                    {formData.deliveryOption === 'deliver' && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Delivery Address *</label>
                        <textarea
                          name="deliveryAddress"
                          value={formData.deliveryAddress}
                          onChange={handleInputChange}
                          required
                          rows="3"
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all resize-none"
                          placeholder="Enter complete delivery address"
                        />
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
                        <input
                          type="file"
                          accept="image/png,image/jpeg"
                          onChange={handleFileChange}
                          className="hidden"
                          id="govId"
                        />
                        <label htmlFor="govId" className="cursor-pointer block">
                          {govIdPreview ? (
                            <img
                              src={govIdPreview}
                              alt="ID Preview"
                              className="mx-auto mb-3 max-h-32 rounded-lg object-contain shadow-md"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                              <Upload className="w-6 h-6 text-gray-600" />
                            </div>
                          )}
                          <p className="text-base font-medium text-gray-700 mb-1">
                            {govIdPreview ? "Click to change" : "Click to upload"}
                          </p>
                          <p className="text-sm text-gray-500">JPEG or PNG (Max 5MB)</p>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* PRICING SUMMARY + SUBMIT BUTTON */}
                  <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 shadow-lg text-white">
                    <h4 className="text-sm font-semibold text-gray-300 mb-3">Pricing Summary</h4>
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-300">Rental ({rentalDays} {rentalDays === 1 ? 'day' : 'days'})</span>
                        <span className="font-semibold">₱{basePrice.toLocaleString()}</span>
                      </div>
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
                      {formData.deliveryOption === 'deliver' && (
                        <p className="text-xs text-gray-400 mt-2">
                          * Delivery fee will be added based on distance
                        </p>
                      )}
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={isSubmitting || !selectedVariant}
                      className={`w-full px-6 py-4 rounded-xl text-lg font-bold transition-all duration-300 transform
                        ${
                          isSubmitting || !selectedVariant
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
            <button
              type="button"
              onClick={handleContractClose}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
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
                {formData.deliveryOption === 'deliver' && (
                  <p className="text-sm text-blue-700 mt-2">
                    <span className="font-medium">Delivery:</span> Fee will be charged when delivered (based on distance)
                  </p>
                )}
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h4 className="font-semibold text-gray-900 mb-3">Terms & Conditions</h4>
                <ul className="list-disc pl-5 text-sm text-gray-700 space-y-2">
                  <li>You accept full financial responsibility for any damage, loss, theft, or violations during your rental period.</li>
                  <li>You agree to notify The Rental Den immediately if an incident happens and to cooperate with any insurance requirements.</li>
                  <li>You agree to cover repair, downtime, and administrative costs that are not covered by insurance.</li>
                  {formData.deliveryOption === 'deliver' && (
                    <li>You understand that delivery fee will be calculated based on the actual distance and charged when the vehicle is delivered.</li>
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
                {contractError && (
                  <p className="text-sm text-red-600 mt-2">{contractError}</p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleContractClose}
                  className="px-6 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-all"
                >
                  Review Form
                </button>
                <button
                  type="button"
                  onClick={handleContractConfirm}
                  disabled={isSubmitting}
                  className={`px-6 py-3 rounded-xl text-white font-semibold transition-all ${
                    isSubmitting ? "bg-gray-400 cursor-not-allowed" : "bg-gray-900 hover:bg-gray-800"
                  }`}
                >
                  {isSubmitting ? "Processing..." : "Sign & Submit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in { animation: slide-in 0.3s ease-out; }
      `}</style>
    </>
  )
}
/* ===========================
   Car Card
   =========================== */
const CarCard = ({ car, onRentClick, onOpenDetails, index }) => {
  const [colorStats, setColorStats] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [cardRef, cardVisible] = useScrollAnimation()

  const isRentalDenVehicle = (vehicle) => {
    const ownerName = (vehicle.owner_name || "").toLowerCase().trim()
    return ownerName === "rental den" || ownerName === "the rental den" || ownerName.includes("rental den")
  }
  const isRentalDen = isRentalDenVehicle(car)

  useEffect(() => {
    const fetchVariantStats = async () => {
      if (!car?.id) return
      setIsLoading(true)
      try {
        const variants = await firebaseService.listVariantsByVehicleId(car.id)
        const today = new Date().toISOString().split("T")[0]
        const allBookings = await firebaseService.listConfirmedBookings()
        const bookings = allBookings.filter((b) => b.rental_end_date >= today && b.rental_start_date <= today)
        const colorGroups = {}
        variants.forEach((variant) => {
          const colorKey = variant.color.toLowerCase().trim()
          if (!colorGroups[colorKey]) colorGroups[colorKey] = { color: variant.color, total: 0, available: 0, rented: 0, unavailable: 0 }
          colorGroups[colorKey].total++
          if (!variant.is_available) {
            colorGroups[colorKey].unavailable++
          } else {
            const isRented = bookings?.some((b) => b.vehicle_variant_id === variant.id)
            if (isRented) colorGroups[colorKey].rented++
            else colorGroups[colorKey].available++
          }
        })
        setColorStats(Object.values(colorGroups))
      } catch (error) {
        console.error("Error fetching variant stats:", error)
        setColorStats([])
      } finally { setIsLoading(false) }
    }
    fetchVariantStats()
  }, [car?.id])

  const getColorHex = (colorName) => {
    const n = colorName.toLowerCase()
    if (n.includes("white") || n.includes("pearl")) return "#ffffff"
    if (n.includes("black") || n.includes("midnight")) return "#1f2937"
    if (n.includes("silver") || n.includes("metallic")) return "#9ca3af"
    if (n.includes("red")) return "#dc2626"
    if (n.includes("blue")) return "#2563eb"
    if (n.includes("gray") || n.includes("grey")) return "#6b7280"
    if (n.includes("green")) return "#16a34a"
    if (n.includes("yellow") || n.includes("gold")) return "#facc15"
    if (n.includes("orange")) return "#f97316"
    if (n.includes("brown")) return "#7c4a31"
    if (n.includes("beige")) return "#e5decf"
    if (n.includes("purple")) return "#8b5cf6"
    if (n.includes("pink")) return "#ec4899"
    return "#e5e7eb"
  }

  const isAvailable = colorStats.some((s) => s.available > 0)

  return (
    <div
      ref={cardRef}
      className={`relative w-full bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 overflow-hidden cursor-pointer group animate-on-scroll animate-fade-up delay-${(index % 6) * 100} ${cardVisible ? "visible" : ""}`}
      onClick={() => onOpenDetails(car)}
    >
      <div className="relative bg-white rounded-2xl overflow-hidden">
        <div className="relative h-52 w-full overflow-hidden">
          <div className="absolute inset-0">
            <img src={defaultBackground} alt="Background" className="w-full h-full object-cover" />
          </div>
          {car.image_url ? (
            <img src={car.image_url} alt={`${car.make} ${car.model}`} loading="lazy"
              className="relative w-full h-full object-contain p-3 transition-transform duration-500 group-hover:scale-110 drop-shadow-lg" />
          ) : (
            <div className="relative w-full h-full flex items-center justify-center">
              <IoCarOutline className="w-20 h-20 text-gray-400" />
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
              <div className={`px-3 py-1.5 rounded-full text-xs font-bold shadow-lg backdrop-blur-sm ${isAvailable ? "bg-green-500/90 text-white" : "bg-gray-900/90 text-white"}`}>
                {isAvailable ? "Available" : "Not Available"}
              </div>
            </div>
          )}
        </div>

        <div className="p-5">
          <div className="mb-3">
            <h3 className="text-xl font-bold text-gray-900 truncate">{car.model}</h3>
            <p className="text-xs text-gray-500 font-medium">{car.make} • {car.year}</p>
          </div>

          <div className="flex items-center gap-3 mb-4">
            {[
              { icon: <IoSpeedometerOutline className="w-3.5 h-3.5" />, value: car.mileage ? `${Number(car.mileage).toLocaleString()}` : "N/A" },
              { icon: <IoPeopleOutline className="w-3.5 h-3.5" />, value: car.seats },
              { icon: <IoCarOutline className="w-3.5 h-3.5" />, value: car.type },
            ].map(({ icon, value }, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
                <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-black group-hover:text-white transition-colors">
                  {icon}
                </div>
                <span className="font-medium">{value}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-black">₱{car.price_per_day}</span>
              <span className="text-xs text-gray-500 font-medium">/day</span>
            </div>
            {isLoading ? (
              <div className="flex gap-1.5">
                {[...Array(2)].map((_, i) => <div key={i} className="w-7 h-7 rounded-lg bg-gray-100 animate-pulse" />)}
              </div>
            ) : colorStats.length > 0 ? (
              <div className="flex gap-1.5">
                {colorStats.slice(0, 3).map((stat, idx) => (
                  <div key={idx} className="relative" title={`${stat.color} - ${stat.available} available`}>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${stat.available > 0 ? "bg-gray-100" : "bg-gray-50 opacity-40"}`}>
                      <div className="w-4 h-4 rounded-full border shadow-sm"
                        style={{ backgroundColor: getColorHex(stat.color), borderColor: getColorHex(stat.color) === "#ffffff" ? "#e5e7eb" : getColorHex(stat.color) }} />
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
              {isLoading ? "Loading..." : !isAvailable ? "Unavailable" : "Rent Now"}
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
  )
}

/* ===========================
   Hero Filter Section
   =========================== */
const HeroFilterSection = ({ onFilterChange }) => {
  const [filters, setFilters] = useState({ type: "All", seats: "All", priceRange: "All" })
  const [vehicleTypes, setVehicleTypes] = useState(["All"])
  const [seatOptions, setSeatOptions] = useState(["All"])
  const [heroRef, heroVisible] = useScrollAnimation()

  useEffect(() => {
    const fetchFilterOptions = async () => {
      const data = await firebaseService.listVehicles()
      if (data) {
        const uniqueTypes = [...new Set(data.map((v) => v.type).filter(Boolean))]
        setVehicleTypes(["All", ...uniqueTypes])
        const uniqueSeats = [...new Set(data.map((v) => v.seats).filter(Boolean))].sort((a, b) => Number(a) - Number(b))
        setSeatOptions(["All", ...uniqueSeats])
      }
    }
    fetchFilterOptions()
  }, [])

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  return (
    <div className="relative py-16 sm:py-20 lg:py-24 bg-cover bg-center" style={{ backgroundImage: `url(${Carpage})` }}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div ref={heroRef} className={`text-center animate-on-scroll animate-fade-down ${heroVisible ? "visible" : ""}`}>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 text-white">Discover Your Perfect Ride</h1>
          <p className="text-lg sm:text-xl text-gray-200 max-w-2xl mx-auto mb-10">Premium car rentals in Cebu — Filter by type, seats, and budget</p>

          <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { label: "Vehicle Type", key: "type", options: vehicleTypes, format: (v) => v },
                { label: "Number of Seats", key: "seats", options: seatOptions, format: (v) => v === "All" ? "All Seats" : `${v} Seats` },
                {
                  label: "Price Range", key: "priceRange",
                  options: ["All", "0-2000", "2000-4000", "4000-6000", "6000+"],
                  format: (v) => v === "All" ? "All Prices" : v === "6000+" ? "₱6,000+" : `₱${v.split("-").join(" - ₱")}`,
                },
              ].map(({ label, key, options, format }) => (
                <div key={key} className="text-left">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
                  <div className="relative">
                    <select value={filters[key]} onChange={(e) => handleFilterChange(key, e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-black focus:border-black transition-all bg-white text-gray-900 font-medium appearance-none cursor-pointer">
                      {options.map((opt) => <option key={opt} value={opt}>{format(opt)}</option>)}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              ))}
            </div>

            {/* Active Filters */}
            {(filters.type !== "All" || filters.seats !== "All" || filters.priceRange !== "All") && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs font-semibold text-gray-500">Active Filters:</span>
                  {filters.type !== "All" && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                      {filters.type}
                      <button onClick={() => handleFilterChange("type", "All")} className="ml-1 hover:text-gray-900">×</button>
                    </span>
                  )}
                  {filters.seats !== "All" && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                      {filters.seats} Seats
                      <button onClick={() => handleFilterChange("seats", "All")} className="ml-1 hover:text-gray-900">×</button>
                    </span>
                  )}
                  {filters.priceRange !== "All" && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                      {filters.priceRange === "6000+" ? "₱6,000+" : `₱${filters.priceRange.split("-").join(" - ₱")}`}
                      <button onClick={() => handleFilterChange("priceRange", "All")} className="ml-1 hover:text-gray-900">×</button>
                    </span>
                  )}
                  <button onClick={() => { setFilters({ type: "All", seats: "All", priceRange: "All" }); onFilterChange({ type: "All", seats: "All", priceRange: "All" }) }}
                    className="text-xs text-gray-500 hover:text-gray-700 underline ml-2">
                    Clear all
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ===========================
   Footer
   =========================== */
const Footer = () => {
  const navigate = useNavigate()
  const handleNavClick = (path) => {
    if (path.includes("#")) {
      const section = path.split("#")[1]
      navigate("/")
      setTimeout(() => document.getElementById(section)?.scrollIntoView({ behavior: "smooth" }), 100)
    } else navigate(path)
  }

  return (
    <footer className="bg-[#101010] text-gray-300 py-12 px-6 md:px-10 lg:px-20">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10">
        <div>
          <h4 className="text-lg font-semibold mb-4">Contact Information</h4>
          <p className="mb-2">Cebu City, Philippines</p>
          <p className="mb-4">+63 900 000 0000</p>
          <div className="flex space-x-3">
            <a href="https://www.facebook.com/profile.php?id=61572309459200" target="_blank" rel="noopener noreferrer"
              className="w-8 h-8 flex items-center justify-center rounded-md bg-gray-800 hover:bg-gray-700 transition">
              <FaFacebookF size={14} />
            </a>
            <a href="#" className="w-8 h-8 flex items-center justify-center rounded-md bg-gray-800 hover:bg-gray-700 transition">
              <FaInstagram size={14} />
            </a>
          </div>
        </div>
        <div>
          <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
          <ul className="space-y-2">
            {[["Home", "/"], ["About Us", "/#about"], ["Cars", "/cars"], ["FAQs", "/#faqs"], ["Contact", "/#contact"]].map(([label, path]) => (
              <li key={path}><button onClick={() => handleNavClick(path)} className="hover:text-white transition-colors">{label}</button></li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-10 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} The Rental Den. All Rights Reserved.
      </div>
    </footer>
  )
}

/* ===========================
   CarsPage Main Component
   =========================== */
const CarsPage = () => {
  const [vehicles, setVehicles] = useState([])
  const [filteredVehicles, setFilteredVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isRentalOpen, setIsRentalOpen] = useState(false)
  const [selectedCar, setSelectedCar] = useState(null)
  const [selectedVariant, setSelectedVariant] = useState(null)
  const [titleRef, titleVisible] = useScrollAnimation()

  useEffect(() => { window.scrollTo(0, 0) }, [])

  const fetchVehicles = async () => {
    try {
      setLoading(true)
      const data = await firebaseService.listVehicles()
      const allVariants = await firebaseService.listAllVariants()
      const variantsByVehicle = {}
      allVariants?.forEach((v) => {
        if (!variantsByVehicle[v.vehicle_id]) variantsByVehicle[v.vehicle_id] = []
        variantsByVehicle[v.vehicle_id].push(v)
      })
      const enriched = (data || []).map((v) => {
        const variants = variantsByVehicle[v.id] || []
        const totalAvailable = variants.reduce((sum, vv) => sum + (vv.available_quantity || 0), 0)
        return { ...v, available: totalAvailable > 0, available_quantity: totalAvailable, total_quantity: variants.length }
      })
      setVehicles(enriched)
      setFilteredVehicles(enriched)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchVehicles() }, [])

  const handleFilterChange = (filters) => {
    let filtered = [...vehicles]
    if (filters.type !== "All") filtered = filtered.filter((v) => v.type === filters.type)
    if (filters.seats !== "All") filtered = filtered.filter((v) => Number(v.seats) === Number(filters.seats))
    if (filters.priceRange !== "All") {
      const [min, max] = filters.priceRange.includes("+")
        ? [Number(filters.priceRange.replace("+", "")), Infinity]
        : filters.priceRange.split("-").map(Number)
      filtered = filtered.filter((v) => { const p = v.price_per_day || 0; return p >= min && (max === Infinity || p <= max) })
    }
    setFilteredVehicles(filtered)
  }

  const handleOpenDetails = (car) => { setSelectedCar(car); setSelectedVariant(null); setIsDetailsOpen(true) }
  const handleRentClick = (car, variant = null) => { setSelectedCar(car); setSelectedVariant(variant); setIsDetailsOpen(false); setIsRentalOpen(true) }

  return (
    <div className="min-h-screen bg-[#F0F5F8] flex flex-col">
      <Navbar />

      {/* pt-20 because Navbar is fixed */}
      <div className="pt-20">
        <HeroFilterSection onFilterChange={handleFilterChange} />

        <section className="py-8 bg-[#F0F5F8] flex-1">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div ref={titleRef} className={`text-center mb-8 animate-on-scroll animate-fade-up ${titleVisible ? "visible" : ""}`}>
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">Available Vehicles</h2>
              <p className="text-lg text-gray-600">
                {filteredVehicles.length} {filteredVehicles.length === 1 ? "vehicle" : "vehicles"} found
              </p>
            </div>

            {loading ? (
              <div className="flex flex-col justify-center items-center py-20">
                <div className="w-16 h-16 border-4 border-gray-200 border-t-black rounded-full animate-spin mb-4"></div>
                <p className="text-lg text-gray-600 font-medium">Loading vehicles...</p>
              </div>
            ) : error ? (
              <div className="flex justify-center items-center py-20">
                <div className="text-lg text-red-600">Error: {error}</div>
              </div>
            ) : filteredVehicles.length === 0 ? (
              <div className="flex flex-col justify-center items-center py-20">
                <IoCarOutline className="w-16 h-16 text-gray-400 mb-4" />
                <p className="text-lg text-gray-600 font-medium">No vehicles match your filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredVehicles.map((vehicle, index) => (
                  <CarCard key={vehicle.id} car={vehicle} onRentClick={handleRentClick} onOpenDetails={handleOpenDetails} index={index} />
                ))}
              </div>
            )}
          </div>
        </section>

        <Footer />
      </div>

      <DetailsModal isOpen={isDetailsOpen} onClose={() => setIsDetailsOpen(false)} car={selectedCar} onRentClick={handleRentClick} />
      <RentalModal isOpen={isRentalOpen} onClose={() => setIsRentalOpen(false)} selectedCar={selectedCar} />

      <style>{`
        @keyframes slide-in { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .animate-slide-in { animation: slide-in 0.3s ease-out; }

        @keyframes fade-up { from { opacity: 0; transform: translateY(60px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fade-down { from { opacity: 0; transform: translateY(-60px); } to { opacity: 1; transform: translateY(0); } }

        .animate-on-scroll:not(.visible) { opacity: 0; transform: translateY(60px); }
        .animate-on-scroll.visible { animation-duration: 0.8s; animation-fill-mode: both; animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1); }
        .animate-fade-up.visible { animation-name: fade-up; }
        .animate-fade-down.visible { animation-name: fade-down; }

        .delay-0   { animation-delay: 0s; }
        .delay-100 { animation-delay: 0.1s; }
        .delay-200 { animation-delay: 0.2s; }
        .delay-300 { animation-delay: 0.3s; }
        .delay-400 { animation-delay: 0.4s; }
        .delay-500 { animation-delay: 0.5s; }
      `}</style>
    </div>
  )
}

export default CarsPage