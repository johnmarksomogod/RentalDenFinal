import { useState, useEffect } from "react"
import {
  Calendar, Search, AlertCircle, Car, ArrowLeft,
  ChevronLeft, ChevronRight, X, User, Clock,
  CreditCard, Upload, MapPin
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import * as firebaseService from "./lib/firebaseService"
import { IoSpeedometerOutline, IoPeopleOutline, IoCarOutline } from "react-icons/io5"
import defaultBackground from "./assets/CarScreen/defaultBg.png"

/* ===========================
   Fuel Helpers (shared)
   =========================== */
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

const GasPumpSVG = ({ strokeColor, size = 14 }) => (
  <svg
    width={size} height={size}
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

/* ===========================
   Color Helper (shared)
   =========================== */
const getColorHex = (colorName) => {
  const name = colorName.toLowerCase()
  if (name.includes("white") || name.includes("pearl")) return "#ffffff"
  if (name.includes("black") || name.includes("midnight")) return "#1f2937"
  if (name.includes("silver") || name.includes("metallic")) return "#9ca3af"
  if (name.includes("red")) return "#dc2626"
  if (name.includes("blue")) return "#2563eb"
  if (name.includes("gray") || name.includes("grey")) return "#6b7280"
  if (name.includes("green")) return "#16a34a"
  if (name.includes("yellow") || name.includes("gold")) return "#facc15"
  if (name.includes("orange")) return "#f97316"
  if (name.includes("brown")) return "#7c4a31"
  if (name.includes("beige")) return "#e5decf"
  if (name.includes("purple")) return "#8b5cf6"
  if (name.includes("pink")) return "#ec4899"
  return "#e5e7eb"
}

/* ===========================
   Toast
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
      <div className={`flex items-center p-4 rounded-lg shadow-lg ${
        type === "success"
          ? "bg-green-100 text-green-800 border border-green-200"
          : "bg-red-100 text-red-800 border border-red-200"
      }`}>
        {type === "success"
          ? <div className="w-5 h-5 mr-3 text-green-600">✓</div>
          : <AlertCircle className="h-5 w-5 mr-3" />}
        <span className="text-sm font-medium">{message}</span>
        <button onClick={onClose} className="ml-4 text-gray-400 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

/* ===========================
   Beautiful Calendar
   =========================== */
const BeautifulCalendar = ({ isOpen, onClose, startDate, endDate, onDateSelect, bookedDates = [] }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [hoveredDate, setHoveredDate] = useState(null)
  const [selectingStartDate, setSelectingStartDate] = useState(!startDate)

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"]

  const getDaysInMonth = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    return { daysInMonth: lastDay.getDate(), startingDayOfWeek: firstDay.getDay(), year, month }
  }

  const isDateDisabled = (date) => {
    const today = new Date(); today.setHours(0,0,0,0)
    const dateStr = date.toISOString().split('T')[0]
    return date < today || bookedDates.includes(dateStr)
  }

  const isDateInRange = (date) => {
    if (!startDate || !endDate) return false
    return date >= new Date(startDate) && date <= new Date(endDate)
  }

  const isDateHoverRange = (date) => {
    if (!startDate || !hoveredDate || endDate) return false
    return date > new Date(startDate) && date <= hoveredDate
  }

  const handleDateClick = (date) => {
    if (isDateDisabled(date)) return
    const dateStr = date.toISOString().split('T')[0]
    if (selectingStartDate || !startDate) {
      onDateSelect(dateStr, null)
      setSelectingStartDate(false)
    } else {
      if (date < new Date(startDate)) {
        onDateSelect(dateStr, null)
      } else {
        onDateSelect(startDate, dateStr)
        setTimeout(() => onClose(), 300)
      }
    }
  }

  const renderMonth = (monthOffset = 0) => {
    const displayDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + monthOffset, 1)
    const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(displayDate)
    const days = []

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="h-12" />)
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      const dateStr = date.toISOString().split('T')[0]
      const disabled = isDateDisabled(date)
      const isStart = startDate === dateStr
      const isEnd = endDate === dateStr
      const inRange = isDateInRange(date)
      const inHoverRange = isDateHoverRange(date)
      const isToday = dateStr === new Date().toISOString().split('T')[0]

      days.push(
        <button key={day} onClick={() => handleDateClick(date)}
          onMouseEnter={() => !disabled && setHoveredDate(date)}
          disabled={disabled}
          className={`relative h-12 flex items-center justify-center text-sm font-medium transition-all duration-200
            ${disabled ? 'text-gray-300 cursor-not-allowed line-through' : 'text-gray-700 hover:bg-blue-50 cursor-pointer'}
            ${isStart || isEnd ? 'bg-black text-white hover:bg-gray-800 font-bold z-10' : ''}
            ${inRange && !isStart && !isEnd ? 'bg-blue-50' : ''}
            ${inHoverRange ? 'bg-blue-100' : ''}
            ${isToday && !isStart && !isEnd ? 'border-2 border-blue-500 font-bold' : ''}
            ${isStart ? 'rounded-l-full' : ''} ${isEnd ? 'rounded-r-full' : ''}
            ${isStart && isEnd ? 'rounded-full' : ''}
          `}
        >
          <span className="relative z-10">{day}</span>
          {(inRange || inHoverRange) && !isStart && !isEnd && (
            <div className="absolute inset-0 bg-blue-50 -z-10" />
          )}
        </button>
      )
    }

    return (
      <div className="flex-1 min-w-[280px]">
        <div className="text-center font-bold text-gray-900 mb-4 text-lg">{monthNames[month]} {year}</div>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
            <div key={d} className="h-8 flex items-center justify-center text-xs font-semibold text-gray-500">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">{days}</div>
      </div>
    )
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9990] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-gray-900 to-black text-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-2xl font-bold">Select Your Dates</h3>
            <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex gap-4">
            <div className="flex-1 bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="text-xs text-gray-300 mb-1">Pickup Date</div>
              <div className="text-lg font-bold">
                {startDate ? new Date(startDate).toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'}) : 'Select date'}
              </div>
            </div>
            <div className="flex-1 bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="text-xs text-gray-300 mb-1">Return Date</div>
              <div className="text-lg font-bold">
                {endDate ? new Date(endDate).toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'}) : 'Select date'}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
            className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-sm text-gray-600">
            {selectingStartDate || !startDate
              ? <span className="font-semibold text-blue-600">① Select pickup date</span>
              : !endDate
                ? <span className="font-semibold text-blue-600">② Select return date</span>
                : <span className="font-semibold text-green-600">✓ Dates selected</span>}
          </div>
          <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
            className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[500px]">
          <div className="flex gap-8 flex-wrap justify-center">
            {renderMonth(0)}
            {renderMonth(1)}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="flex gap-4 text-xs text-gray-600">
            {[['border-2 border-blue-500','Today'],['bg-black','Selected'],['bg-blue-50','Range']].map(([cls,label]) => (
              <div key={label} className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded ${cls}`} /><span>{label}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={() => { onDateSelect(null,null); setSelectingStartDate(true) }}
              className="px-6 py-2 border-2 border-gray-300 rounded-xl font-semibold hover:border-gray-400 transition-all">Clear</button>
            <button onClick={onClose} disabled={!startDate || !endDate}
              className="px-6 py-2 bg-black text-white rounded-xl font-semibold hover:bg-gray-800 transition-all disabled:bg-gray-300 disabled:cursor-not-allowed">Confirm</button>
          </div>
        </div>
      </div>
    </div>
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
    if (isOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = 'auto'
    return () => { document.body.style.overflow = 'auto' }
  }, [isOpen])

  useEffect(() => {
    const fetchVariants = async () => {
      if (!car?.id) return
      const variantsData = await firebaseService.listVariantsByVehicleId(car.id)
      const today = new Date().toISOString().split('T')[0]
      const allBookings = await firebaseService.listConfirmedBookings()
      const bookings = allBookings.filter(b => b.status === "confirmed" && b.rental_end_date >= today && b.rental_start_date <= today)

      const stats = {}
      variantsData.forEach(variant => {
        const isRented = bookings?.some(b => b.vehicle_variant_id === variant.id)
        stats[variant.id] = {
          isAvailable: variant.is_available && !isRented,
          isRented,
          isMaintenance: !variant.is_available
        }
      })

      const groups = {}
      variantsData.forEach(variant => {
        const colorKey = variant.color.toLowerCase().trim()
        if (!groups[colorKey]) groups[colorKey] = { color: variant.color, variants: [] }
        groups[colorKey].variants.push(variant)
      })

      setVariants(variantsData || [])
      setVariantStats(stats)
      setColorGroups(Object.values(groups))
      const firstAvailable = variantsData.find(v => stats[v.id]?.isAvailable)
      setSelectedVariant(firstAvailable || variantsData[0])
    }

    if (isOpen) fetchVariants()
  }, [isOpen, car])

  if (!isOpen || !car) return null

  const stats = variantStats[selectedVariant?.id] || {}
  const fuelColor = getFuelColor(car.fuel_type)

  return (
    <div className="fixed inset-0 bg-white z-[9995] flex flex-col">
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="text-2xl font-bold text-gray-900">Vehicle Details</div>
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all">
          <X className="w-5 h-5 text-gray-900" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="grid lg:grid-cols-2 gap-0">
          {/* Left - Car Image */}
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

          {/* Right - Details */}
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
                  {[
                    ['Mileage', car.mileage ? `${Number(car.mileage).toLocaleString()} km` : 'N/A'],
                    ['Seats', `${car.seats} Seater`],
                    ['Type', car.type || 'N/A'],
                    ['Year', car.year],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <div className="text-xs text-gray-500 mb-1">{label}</div>
                      <div className="text-sm font-semibold text-gray-900">{value}</div>
                    </div>
                  ))}
                  {/* Fuel Type — colored */}
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Fuel Type</div>
                    <div className="text-sm font-semibold flex items-center gap-1.5" style={{ color: fuelColor }}>
                      <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${fuelColor}1a` }}>
                        <GasPumpSVG strokeColor={fuelColor} size={12} />
                      </div>
                      {car.fuel_type || "N/A"}
                    </div>
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
                  {colorGroups.map(colorGroup => {
                    const bgColor = getColorHex(colorGroup.color)
                    const availableCount = colorGroup.variants.filter(v => variantStats[v.id]?.isAvailable).length
                    const totalCount = colorGroup.variants.length
                    const hasAvailable = availableCount > 0
                    const isSelected = colorGroup.variants.some(v => v.id === selectedVariant?.id)

                    return (
                      <button key={colorGroup.color}
                        onClick={() => {
                          const firstAvailable = colorGroup.variants.find(v => variantStats[v.id]?.isAvailable)
                          setSelectedVariant(firstAvailable || colorGroup.variants[0])
                        }}
                        disabled={!hasAvailable}
                        className={`relative p-2 rounded-lg border-2 transition-all duration-200
                          ${isSelected ? 'border-black bg-gray-50 shadow-md' : hasAvailable ? 'border-gray-200 hover:border-gray-400 bg-white' : 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'}
                        `}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <div className="relative">
                            <div className={`w-10 h-10 rounded-full ${isSelected ? 'ring-2 ring-black ring-offset-1' : ''}`}
                              style={{ backgroundColor: bgColor, border: bgColor === "#ffffff" ? "2px solid #e5e7eb" : "none" }} />
                            {totalCount > 1 && (
                              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-black text-white text-[9px] rounded-full flex items-center justify-center font-bold border border-white">{totalCount}</span>
                            )}
                            {!hasAvailable && (
                              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border border-white" />
                            )}
                          </div>
                          <div className="text-center">
                            <div className={`text-xs font-semibold ${isSelected ? 'text-black' : 'text-gray-700'}`}>{colorGroup.color}</div>
                            <div className="text-[10px] text-gray-500">{availableCount}/{totalCount}</div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {selectedVariant && (
                <div className={`rounded-xl p-4 border-2 ${stats.isAvailable ? 'bg-green-50 border-green-200' : stats.isRented ? 'bg-orange-50 border-orange-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-gray-600 mb-1">Selected Color</div>
                      <div className="text-lg font-bold text-gray-900">{selectedVariant.color}</div>
                      <div className="text-xs text-gray-600 mt-1">Plate: <span className="font-semibold">{selectedVariant.plate_number}</span></div>
                    </div>
                    <div className={`px-3 py-1.5 rounded-lg font-semibold text-xs ${stats.isAvailable ? 'bg-green-600 text-white' : stats.isRented ? 'bg-orange-600 text-white' : 'bg-red-600 text-white'}`}>
                      {stats.isAvailable ? '✓ Available' : stats.isRented ? 'Rented' : 'Maintenance'}
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  if (!stats.isAvailable) {
                    alert(stats.isRented ? 'This color is currently rented. Please select another color.' : 'This vehicle is under maintenance.')
                    return
                  }
                  onClose()
                  onRentClick(car, selectedVariant)
                }}
                disabled={!stats.isAvailable}
                className={`w-full py-3 rounded-xl text-base font-bold transition-all ${stats.isAvailable ? 'bg-black text-white hover:bg-gray-800' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
              >
                {stats.isAvailable ? 'Book This Vehicle' : stats.isRented ? 'Currently Rented' : 'Unavailable'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ===========================
   Rental Modal
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
          if (!groups[colorKey]) groups[colorKey] = { color: variant.color, variants: [] }
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
        setTotalPrice(days * (selectedVariant?.price_per_day || selectedCar.price_per_day || 0))
      } else {
        setRentalDays(0); setTotalPrice(0)
      }
    } else {
      setRentalDays(0); setTotalPrice(0)
    }
  }, [formData.pickupDate, formData.returnDate, selectedCar, selectedVariant])

  const showToast = (type, message) => setToast({ type, message, isVisible: true })
  const hideToast = () => setToast((t) => ({ ...t, isVisible: false }))
  const normalizeName = (value = "") => value.replace(/\s+/g, " ").trim().toLowerCase()

  const formatContractDate = (value) => {
    if (!value) return ""
    return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
  }

  const getVehicleSummary = () => {
    const parts = [selectedCar?.year, selectedCar?.make, selectedCar?.model].filter(Boolean)
    const base = parts.join(" ") || "Selected vehicle"
    const color = selectedVariant?.color ? ` (${selectedVariant.color})` : ""
    return `${base}${color}`
  }

  const buildContractDetails = (signedAtISO) => {
    const customerName = formData.fullName.trim()
    const contractParagraphs = [
      `I, ${customerName}, confirm that I am renting ${getVehicleSummary()} from The Rental Den for the period of ${formatContractDate(formData.pickupDate)} to ${formatContractDate(formData.returnDate)}.`,
      "I accept full financial responsibility for any loss, collision damage, vandalism, or civil penalties incurred during this rental period, apart from normal wear and tear.",
      "I agree to immediately report any incident to The Rental Den, to cooperate with insurance requirements, and to settle any repair or downtime costs that are not covered by insurance or security deposits.",
      `By typing my full legal name, I agree that this serves as my digital signature dated ${formatContractDate(signedAtISO)}.`,
    ]
    return { text: contractParagraphs.join("\n\n"), signedName: customerName, signedAt: signedAtISO }
  }

  const validateBookingForm = () => {
    if (!formData.vehicleVariantId) return "Please select a color variant."
    if (!govIdFile) return "Please upload a valid Driver's License Card image."
    if (!formData.pickupDate || !formData.returnDate) return "Please set a valid rental date range."
    if (formData.deliveryOption === 'deliver' && !formData.deliveryAddress) return "Please enter a delivery address."
    const start = new Date(formData.pickupDate)
    const end = new Date(formData.returnDate)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return "Please set a valid rental date range."
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (bookedDates.includes(new Date(d).toISOString().split("T")[0])) return "Selected dates are already booked. Please choose different dates."
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
    setContractSignature(""); setContractError(""); setContractModalVisible(true)
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
        showToast("success", emailResult.success ? "Booking submitted and confirmation email sent!" : "Booking submitted! (Email notification may be delayed)")
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
      setContractError("The name you entered must exactly match your full name on the form."); return
    }
    const signedAtISO = new Date().toISOString()
    const contractDetails = buildContractDetails(signedAtISO)
    setContractModalVisible(false); setContractError("")
    await submitBooking(contractDetails)
  }

  const handleContractClose = () => {
    if (isSubmitting) return
    setContractModalVisible(false); setContractSignature(""); setContractError("")
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
          style={{ backgroundColor: bgColor, border: bgColor === '#ffffff' ? '2px solid #e5e7eb' : 'none' }}
          title={`${colorGroup.color} - ${availableCount}/${totalCount} available`}
        />
        {totalCount > 1 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-black text-white text-[9px] rounded-full flex items-center justify-center font-bold border border-white">{totalCount}</span>
        )}
        {availableCount === 0 && (
          <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
        )}
      </div>
    )
  }

  if (!isOpen) return null

  const displayCar = selectedCar || { make: 'Toyota', model: 'Camry', year: 2024, seats: 5, price_per_day: 3500, image_url: defaultBackground }
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
            <button onClick={onClose} className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all duration-200 hover:scale-105">
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
                        <img src={selectedVariant?.image_url || displayCar?.image_url} alt={`${displayCar?.make} ${displayCar?.model}`} className="w-full h-full object-contain drop-shadow-2xl" />
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
                      {/* Fuel type chip — colored */}
                      {displayCar?.fuel_type && (
                        <span
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold"
                          style={{ color: fuelColor, backgroundColor: `${fuelColor}1a` }}
                        >
                          <GasPumpSVG strokeColor={fuelColor} size={14} />
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
                      <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center"><User className="w-4 h-4 text-white" /></div>
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
                      <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center"><Clock className="w-4 h-4 text-white" /></div>
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
                        <p className="text-sm text-amber-800"><strong>Note:</strong> Some dates are unavailable for this color. Choose available dates only.</p>
                      </div>
                    )}
                  </div>

                  {/* Pickup or Delivery */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center"><MapPin className="w-4 h-4 text-white" /></div>
                      Pickup or Delivery
                    </h3>
                    <p className="text-sm text-gray-500 mb-4 ml-11">Choose how you'd like to receive the vehicle.</p>
                    <div className="grid gap-3 md:grid-cols-2 mb-5">
                      <button type="button" onClick={() => setFormData(s => ({ ...s, deliveryOption: 'pickup', deliveryAddress: '' }))}
                        className={`p-4 rounded-xl border-2 transition-all text-left ${formData.deliveryOption === 'pickup' ? 'border-gray-900 bg-gray-50 shadow-sm' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${formData.deliveryOption === 'pickup' ? 'border-gray-900' : 'border-gray-300'}`}>
                            {formData.deliveryOption === 'pickup' && <div className="w-3 h-3 rounded-full bg-gray-900" />}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">🏠 Self-Pickup</div>
                            <div className="text-xs text-gray-500 mt-1 leading-relaxed">Pick up the car at the owner's garage</div>
                          </div>
                        </div>
                      </button>
                      <button type="button" onClick={() => setFormData(s => ({ ...s, deliveryOption: 'deliver', pickupLocation: '' }))}
                        className={`p-4 rounded-xl border-2 transition-all text-left ${formData.deliveryOption === 'deliver' ? 'border-gray-900 bg-gray-50 shadow-sm' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${formData.deliveryOption === 'deliver' ? 'border-gray-900' : 'border-gray-300'}`}>
                            {formData.deliveryOption === 'deliver' && <div className="w-3 h-3 rounded-full bg-gray-900" />}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">🚗 Delivery</div>
                            <div className="text-xs text-gray-500 mt-1 leading-relaxed">We deliver the car to your address</div>
                          </div>
                        </div>
                      </button>
                    </div>
                    {formData.deliveryOption === 'pickup' && (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                        <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zm0 16a2 2 0 002-2H8a2 2 0 002 2z" />
                        </svg>
                        <div>
                          <p className="text-sm font-semibold text-amber-900 mb-1">Pickup location will be sent after approval</p>
                          <p className="text-sm text-amber-800 leading-relaxed">The exact garage address of the vehicle owner will be shared with you once your booking is <strong>approved or confirmed</strong>. There's no need to enter a location at this stage.</p>
                        </div>
                      </div>
                    )}
                    {formData.deliveryOption === 'deliver' && (
                      <div className="space-y-4">
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
                          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                          <div>
                            <p className="text-sm font-semibold text-blue-900 mb-1">Delivery fee charged on arrival</p>
                            <p className="text-sm text-blue-800 leading-relaxed">The fee is calculated based on the distance from the owner's garage to your address and will be charged when the vehicle is delivered to you.</p>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Delivery Address *</label>
                          <textarea name="deliveryAddress" value={formData.deliveryAddress} onChange={handleInputChange} required rows="3"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all resize-none"
                            placeholder="Enter your complete delivery address" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Identity Verification */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center"><CreditCard className="w-4 h-4 text-white" /></div>
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
                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3"><Upload className="w-6 h-6 text-gray-600" /></div>
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
                        <p className="text-xs text-gray-400 mt-2">* Delivery fee will be added based on distance</p>
                      )}
                    </div>
                    <button type="submit" disabled={isSubmitting || !selectedVariant}
                      className={`w-full px-6 py-4 rounded-xl text-lg font-bold transition-all duration-300 transform
                        ${isSubmitting || !selectedVariant ? "bg-gray-600 text-gray-300 cursor-not-allowed" : "bg-white text-gray-900 hover:bg-gray-100 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"}`}>
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
              <p className="text-sm text-gray-600">Please review and sign our rental damage responsibility agreement before submitting your booking.</p>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Rental Summary</h4>
                <p className="text-sm text-gray-700 mb-1"><span className="font-medium">Vehicle:</span> {getVehicleSummary()}</p>
                <p className="text-sm text-gray-700 mb-1"><span className="font-medium">Rental Period:</span> {formatContractDate(formData.pickupDate)} – {formatContractDate(formData.returnDate)}</p>
                <p className="text-sm text-gray-700"><span className="font-medium">Rental Total:</span> ₱{totalPrice.toLocaleString()}</p>
                {formData.deliveryOption === 'pickup' && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800"><span className="font-semibold">🏠 Self-Pickup:</span> The owner's garage address will be sent to you once your booking is approved or confirmed.</p>
                  </div>
                )}
                {formData.deliveryOption === 'deliver' && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800"><span className="font-semibold">🚗 Delivery:</span> Delivery fee will be charged based on distance when the vehicle is delivered to you.</p>
                  </div>
                )}
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h4 className="font-semibold text-gray-900 mb-3">Terms & Conditions</h4>
                <ul className="list-disc pl-5 text-sm text-gray-700 space-y-2">
                  <li>You accept full financial responsibility for any damage, loss, theft, or violations during your rental period.</li>
                  <li>You agree to notify The Rental Den immediately if an incident happens and to cooperate with any insurance requirements.</li>
                  <li>You agree to cover repair, downtime, and administrative costs that are not covered by insurance.</li>
                  {formData.deliveryOption === 'pickup' && <li>You understand that the pickup address (owner's garage) will be provided to you once your booking is approved or confirmed.</li>}
                  {formData.deliveryOption === 'deliver' && <li>You understand that the delivery fee will be calculated based on actual distance and charged when the vehicle is delivered.</li>}
                  <li>Typing your full name below serves as your legally binding digital signature.</li>
                </ul>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Type your full name to sign *</label>
                <input type="text" value={contractSignature} onChange={(e) => setContractSignature(e.target.value)}
                  placeholder={formData.fullName || "Enter your full name"}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all" />
                {contractError && <p className="text-sm text-red-600 mt-2">{contractError}</p>}
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={handleContractClose}
                  className="px-6 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-all">Review Form</button>
                <button type="button" onClick={handleContractConfirm} disabled={isSubmitting}
                  className={`px-6 py-3 rounded-xl text-white font-semibold transition-all ${isSubmitting ? "bg-gray-400 cursor-not-allowed" : "bg-gray-900 hover:bg-gray-800"}`}>
                  {isSubmitting ? "Processing..." : "Sign & Submit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-in { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .animate-slide-in { animation: slide-in 0.3s ease-out; }
      `}</style>
    </>
  )
}

/* ===========================
   Calendar Booking Page
   =========================== */
const CalendarBookingPage = () => {
  const navigate = useNavigate()
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [availableVehicles, setAvailableVehicles] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [rentalDays, setRentalDays] = useState(0)
  const [error, setError] = useState("")
  const [showCalendar, setShowCalendar] = useState(false)

  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isRentalOpen, setIsRentalOpen] = useState(false)
  const [selectedCar, setSelectedCar] = useState(null)
  const [selectedVariant, setSelectedVariant] = useState(null)

  const handleOpenDetails = (car) => { setSelectedCar(car); setSelectedVariant(null); setIsDetailsOpen(true) }
  const handleRentClick = (car, variant = null) => { setSelectedCar(car); setSelectedVariant(variant); setIsDetailsOpen(false); setIsRentalOpen(true) }

  const calculateDays = (start, end) => {
    if (!start || !end) return 0
    const diff = Math.ceil((new Date(end) - new Date(start)) / (1000 * 3600 * 24))
    return diff === 0 ? 1 : diff
  }

  useEffect(() => {
    setRentalDays(startDate && endDate ? calculateDays(startDate, endDate) : 0)
  }, [startDate, endDate])

  const isRentalDenVehicle = (vehicle) => {
    const ownerName = (vehicle.owner_name || '').toLowerCase().trim()
    return ownerName === 'rental den' || ownerName === 'the rental den' || ownerName.includes('rental den')
  }

  const searchAvailableVehicles = async () => {
    if (!startDate || !endDate) { setError("Please select both start and end dates"); return }
    if (new Date(endDate) < new Date(startDate)) { setError("End date must be after start date"); return }

    setLoading(true); setSearched(true); setError("")

    try {
      const allVehicles = await firebaseService.listVehicles()
      const allBookings = await firebaseService.listConfirmedBookings()
      const searchStart = new Date(startDate)
      const searchEnd = new Date(endDate)

      const conflicting = (allBookings || []).filter(b => {
        const bStart = new Date(b.rental_start_date)
        const bEnd = new Date(b.rental_end_date)
        return bStart <= searchEnd && bEnd >= searchStart
      })
      const bookedVariantIds = new Set(conflicting.map(b => b.vehicle_variant_id))

      const available = []
      for (const vehicle of allVehicles) {
        const variants = await firebaseService.listVariantsByVehicleId(vehicle.id)
        if (!variants?.length) continue
        const availableVariants = variants.filter(v => v.is_available !== false && !bookedVariantIds.has(v.id))
        if (availableVariants.length > 0) available.push({ ...vehicle, availableVariants })
      }

      const sorted = available.sort((a, b) => {
        const aRD = isRentalDenVehicle(a), bRD = isRentalDenVehicle(b)
        if (aRD && !bRD) return -1
        if (!aRD && bRD) return 1
        return 0
      })

      setAvailableVehicles(sorted)
    } catch (err) {
      console.error("Error searching vehicles:", err)
      setError("An error occurred while searching. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  /* --- VehicleCard (inner component) --- */
  const VehicleCard = ({ vehicle }) => {
    const [colorGroups, setColorGroups] = useState([])
    const isRentalDen = isRentalDenVehicle(vehicle)
    const fuelColor = getFuelColor(vehicle.fuel_type)

    useEffect(() => {
      const groups = {}
      vehicle.availableVariants?.forEach(variant => {
        const key = variant.color.toLowerCase().trim()
        if (!groups[key]) groups[key] = { color: variant.color, variants: [] }
        groups[key].variants.push(variant)
      })
      setColorGroups(Object.values(groups))
    }, [vehicle])

    return (
      <div className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 overflow-hidden group">
        {/* Image */}
        <div className="relative h-52 w-full overflow-hidden">
          <div className="absolute inset-0">
            <img src={defaultBackground} alt="Background" className="w-full h-full object-cover" />
          </div>
          {vehicle.image_url
            ? <img src={vehicle.image_url} alt={`${vehicle.make} ${vehicle.model}`}
                className="relative w-full h-full object-contain p-3 transition-transform duration-500 group-hover:scale-110 drop-shadow-lg" />
            : <div className="relative w-full h-full flex items-center justify-center"><Car className="w-20 h-20 text-gray-400" /></div>
          }
          {/* Owner Badge */}
          <div className="absolute top-3 right-3">
            {isRentalDen ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg backdrop-blur-sm bg-white text-black border border-gray-200">
                <svg className="w-3.5 h-3.5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                </svg>
                <span>Rental Den</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg backdrop-blur-sm bg-gray-800 text-white border border-gray-700">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>
                </svg>
                <span>Partner</span>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          <div className="mb-3">
            <h3 className="text-xl font-bold text-gray-900 truncate">{vehicle.model}</h3>
            <p className="text-xs text-gray-500 font-medium">{vehicle.make} • {vehicle.year}</p>
          </div>

          <div className="flex items-center gap-3 mb-4 flex-wrap">
            {[
              [IoSpeedometerOutline, vehicle.mileage ? Number(vehicle.mileage).toLocaleString() : 'N/A'],
              [IoPeopleOutline, vehicle.seats],
              [IoCarOutline, vehicle.type],
            ].map(([Icon, val], i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
                <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="font-medium">{val}</span>
              </div>
            ))}
            {/* Fuel chip — colored, matching CarCard */}
            {vehicle.fuel_type && (
              <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: fuelColor }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${fuelColor}1a` }}>
                  <GasPumpSVG strokeColor={fuelColor} size={14} />
                </div>
                <span>{vehicle.fuel_type}</span>
              </div>
            )}
          </div>

          {/* Deposit Badge — matches CarCard */}
          {vehicle.deposit_amount && (
            <div className="mb-4 p-2 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <p className="text-[10px] font-semibold text-amber-900 leading-tight">
                    ₱{Number(vehicle.deposit_amount).toLocaleString()} Deposit
                  </p>
                  <p className="text-[9px] text-amber-700 leading-tight">Refundable</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-black">₱{vehicle.price_per_day}</span>
              <span className="text-xs text-gray-500 font-medium">/day</span>
            </div>
            <div className="flex gap-1.5">
              {colorGroups.slice(0, 3).map((cg, idx) => (
                <div key={idx} className="relative" title={`${cg.color} - ${cg.variants.length} available`}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-gray-100">
                    <div className="w-4 h-4 rounded-full border shadow-sm"
                      style={{ backgroundColor: getColorHex(cg.color), borderColor: getColorHex(cg.color) === '#ffffff' ? '#e5e7eb' : getColorHex(cg.color) }} />
                  </div>
                  {cg.variants.length > 1 && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-black text-white text-[9px] rounded-full flex items-center justify-center font-bold border border-white">
                      {cg.variants.length}
                    </div>
                  )}
                </div>
              ))}
              {colorGroups.length > 3 && (
                <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-600">+{colorGroups.length - 3}</div>
              )}
            </div>
          </div>

          {rentalDays > 0 && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl">
              <div className="text-xs text-green-700 mb-1">Total for {rentalDays} days:</div>
              <div className="text-xl font-bold text-green-900">₱{(vehicle.price_per_day * rentalDays).toLocaleString()}</div>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => handleRentClick(vehicle, vehicle.availableVariants[0])}
              className="flex-1 py-2.5 px-3 rounded-xl font-bold text-sm bg-black text-white hover:bg-gray-900 hover:scale-105 transition-all duration-300 transform shadow-lg hover:shadow-xl">
              Book Now
            </button>
            <button onClick={() => handleOpenDetails(vehicle)}
              className="flex-1 py-2.5 px-3 border-2 border-gray-200 text-sm rounded-xl font-bold hover:border-black hover:bg-gray-50 transition-all duration-300 transform hover:scale-105">
              Details
            </button>
          </div>
        </div>
      </div>
    )
  }

  const rentalDenVehicles = availableVehicles.filter(v => isRentalDenVehicle(v))
  const partnerVehicles = availableVehicles.filter(v => !isRentalDenVehicle(v))

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-gray-50 to-white">
      <DetailsModal isOpen={isDetailsOpen} onClose={() => setIsDetailsOpen(false)} car={selectedCar} onRentClick={handleRentClick} />
      <RentalModal isOpen={isRentalOpen} onClose={() => setIsRentalOpen(false)} selectedCar={selectedCar} selectedVariant={selectedVariant} refreshBookings={async () => {}} />

      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 to-black text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-white/80 hover:text-white mb-8 transition-colors">
            <ArrowLeft className="w-5 h-5" /><span className="font-medium">Back to Home</span>
          </button>

          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">Find Your Perfect Ride</h1>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto mb-8">Select your dates and discover available vehicles</p>

            <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
              <div className="grid md:grid-cols-3 gap-4 items-end">
                <div className="text-left">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Pickup Date *</label>
                  <button onClick={() => setShowCalendar(true)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl hover:border-black transition-all bg-white text-gray-900 text-left flex items-center justify-between group">
                    <span className={startDate ? "text-gray-900" : "text-gray-400"}>
                      {startDate ? new Date(startDate).toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'}) : "Select date"}
                    </span>
                    <Calendar className="w-5 h-5 text-gray-400 group-hover:text-black transition-colors" />
                  </button>
                </div>
                <div className="text-left">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Return Date *</label>
                  <button onClick={() => setShowCalendar(true)} disabled={!startDate}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl hover:border-black transition-all bg-white disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900 text-left flex items-center justify-between group">
                    <span className={endDate ? "text-gray-900" : "text-gray-400"}>
                      {endDate ? new Date(endDate).toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'}) : "Select date"}
                    </span>
                    <Calendar className="w-5 h-5 text-gray-400 group-hover:text-black transition-colors" />
                  </button>
                </div>
                <button onClick={searchAvailableVehicles} disabled={loading || !startDate || !endDate}
                  className="w-full py-3 px-6 bg-black text-white rounded-xl font-bold text-base hover:bg-gray-800 transition-all transform hover:scale-105 shadow-lg hover:shadow-xl disabled:bg-gray-400 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2">
                  {loading ? (
                    <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />Searching...</>
                  ) : (
                    <><Search className="w-5 h-5" />Search Vehicles</>
                  )}
                </button>
              </div>

              {rentalDays > 0 && (
                <div className="mt-4 p-3 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg text-center border border-green-200">
                  <span className="text-sm text-gray-600">Rental Duration: </span>
                  <span className="text-lg font-bold text-gray-900">{rentalDays} {rentalDays === 1 ? 'day' : 'days'}</span>
                </div>
              )}

              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <BeautifulCalendar isOpen={showCalendar} onClose={() => setShowCalendar(false)} startDate={startDate} endDate={endDate}
        onDateSelect={(start, end) => { setStartDate(start || ""); setEndDate(end || "") }} bookedDates={[]} />

      {/* Results */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 border-4 border-gray-200 border-t-black rounded-full animate-spin mb-4" />
            <p className="text-lg text-gray-600 font-medium">Searching available vehicles...</p>
          </div>
        )}

        {!loading && searched && availableVehicles.length > 0 && (
          <>
            <div className="mb-12">
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 bg-black text-white px-4 py-2 rounded-full mb-3">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                  </svg>
                  <span className="font-bold">Rental Den Fleet</span>
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Available from Rental Den</h2>
                <p className="text-gray-600">Our premium fleet for your selected dates</p>
              </div>
              {rentalDenVehicles.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                  {rentalDenVehicles.map(v => <VehicleCard key={v.id} vehicle={v} />)}
                </div>
              ) : (
                <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-8 text-center">
                  <AlertCircle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 mb-2">No Rental Den Vehicles Available</h3>
                  <p className="text-gray-600">Check our trusted partner vehicles below!</p>
                </div>
              )}
            </div>

            {partnerVehicles.length > 0 && (
              <div id="partner-section" className="mb-12">
                <div className="mb-6">
                  <div className="inline-flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-full mb-3">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>
                    </svg>
                    <span className="font-bold">Partner Network</span>
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">Available from Our Partners</h2>
                  <p className="text-gray-600">Quality vehicles from our trusted partner network</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold text-gray-900">Partner Vehicles — </span>
                      All vehicles meet our quality and safety standards.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                  {partnerVehicles.map(v => <VehicleCard key={v.id} vehicle={v} />)}
                </div>
              </div>
            )}
          </>
        )}

        {!loading && searched && availableVehicles.length === 0 && (
          <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-12 text-center">
            <Car className="w-20 h-20 text-gray-400 mx-auto mb-6" />
            <h3 className="text-2xl font-bold text-gray-900 mb-3">No Vehicles Available</h3>
            <p className="text-gray-600 text-lg mb-6 max-w-2xl mx-auto">
              No vehicles available for {startDate && endDate && `${new Date(startDate).toLocaleDateString('en-US', {month:'short',day:'numeric'})} – ${new Date(endDate).toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'})}`}. Please try different dates.
            </p>
            <button onClick={() => { setStartDate(""); setEndDate(""); setSearched(false); setShowCalendar(true) }}
              className="px-8 py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-800 transition-all">
              Try Different Dates
            </button>
          </div>
        )}

        {!loading && !searched && (
          <div className="text-center py-20">
            <Calendar className="w-24 h-24 text-gray-300 mx-auto mb-6" />
            <h3 className="text-2xl font-bold text-gray-900 mb-3">Ready to Find Your Perfect Ride?</h3>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto mb-8">Select your pickup and return dates above to see all available vehicles.</p>
            <button onClick={() => setShowCalendar(true)}
              className="inline-flex items-center gap-2 px-8 py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-800 transition-all transform hover:scale-105 shadow-lg">
              <Calendar className="w-5 h-5" />Open Calendar
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slide-in { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .animate-slide-in { animation: slide-in 0.3s ease-out; }
      `}</style>
    </div>
  )
}

export default CalendarBookingPage