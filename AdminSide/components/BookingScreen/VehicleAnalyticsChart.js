import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Modal,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Rect, Text as SvgText } from "react-native-svg";
import { bookingsService } from "../../services/firebaseService";

const { width } = Dimensions.get("window");

const monthNames = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

export default function VehicleAnalyticsChart() {
  const [vehicleFilter, setVehicleFilter] = useState("Weekly");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedWeekRange, setSelectedWeekRange] = useState(null);

  const [yearDropdownVisible, setYearDropdownVisible] = useState(false);
  const [monthDropdownVisible, setMonthDropdownVisible] = useState(false);
  const [weekDropdownVisible, setWeekDropdownVisible] = useState(false);

  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    fetchVehicleData();
  }, [vehicleFilter, selectedYear, selectedMonth, selectedWeekRange]);

  const fetchVehicleData = async () => {
    try {
      let startDate, endDate;

      if (vehicleFilter === "Today") {
        startDate = new Date(selectedYear, selectedMonth, new Date().getDate());
        endDate = new Date(startDate);
      } else if (vehicleFilter === "Weekly") {
        const now = new Date();
        const firstDay = now.getDate() - now.getDay() + 1;
        startDate = new Date(now.setDate(firstDay));
        endDate = new Date(now.setDate(firstDay + 6));
      } else if (vehicleFilter === "Monthly") {
        startDate = new Date(selectedYear, selectedMonth, 1);
        endDate = new Date(selectedYear, selectedMonth + 1, 0);
      } else {
        startDate = new Date(selectedYear, 0, 1);
        endDate = new Date(selectedYear, 11, 31);
      }

      const allBookings = await bookingsService.listWithDetails();
      const data = allBookings.filter(
        (b) =>
          b.rental_start_date >= startDate.toISOString().split("T")[0] &&
          b.rental_start_date <= endDate.toISOString().split("T")[0]
      );

      // Group by vehicle
      const vehicleBookings = data.reduce((acc, booking) => {
        const vehicleKey = booking.vehicle_id;
        const vehicleName = booking.vehicles 
          ? `${booking.vehicles.year} ${booking.vehicles.make} ${booking.vehicles.model}`
          : 'Unknown Vehicle';
        
        if (!acc[vehicleKey]) {
          acc[vehicleKey] = {
            name: vehicleName,
            bookings: 0,
            revenue: 0,
            completedBookings: 0,
            pendingBookings: 0,
            confirmedBookings: 0,
            cancelledBookings: 0
          };
        }
        
        acc[vehicleKey].bookings += 1;
        if (booking.status === 'completed') {
          acc[vehicleKey].revenue += Number(booking.total_price);
          acc[vehicleKey].completedBookings += 1;
        } else if (booking.status === 'pending') {
          acc[vehicleKey].pendingBookings += 1;
        } else if (booking.status === 'confirmed') {
          acc[vehicleKey].confirmedBookings += 1;
        } else if (booking.status === 'cancelled') {
          acc[vehicleKey].cancelledBookings += 1;
        }
        
        return acc;
      }, {});

      // Convert to array and sort by bookings
      const vehicleArray = Object.entries(vehicleBookings)
        .map(([id, data]) => ({
          id,
          ...data,
          label: data.name.length > 15 ? data.name.substring(0, 15) + '...' : data.name
        }))
        .sort((a, b) => b.bookings - a.bookings)
        .slice(0, 10); // Top 10 vehicles

      setChartData(vehicleArray);
    } catch (err) {
      console.error("Error fetching vehicle data:", err);
      setChartData([]); // Set empty array on error
    }
  };

  const getWeekRanges = () => {
    const year = selectedYear;
    const month = selectedMonth;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const weeks = [];
    let currentWeekStart = new Date(firstDay);
    
    const dayOfWeek = currentWeekStart.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    currentWeekStart.setDate(currentWeekStart.getDate() - daysToMonday);
    
    while (currentWeekStart <= lastDay) {
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const weekStart = new Date(currentWeekStart);
      const label = `${weekStart.getDate()}/${weekStart.getMonth() + 1} - ${weekEnd.getDate()}/${weekEnd.getMonth() + 1}`;
      
      weeks.push({
        label,
        start: new Date(weekStart),
        end: new Date(weekEnd)
      });
      
      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    }
    
    return weeks;
  };

  const renderBarChart = () => {
    const chartHeight = 200;
    const chartWidth = width - 80;
    const hasData = chartData.length > 0;
    
    if (!hasData) {
      // Render empty state with chart structure
      return (
        <View style={styles.chartContainer}>
          <View style={{ flexDirection: "row" }}>
            <View style={styles.yAxis}>
              <Text style={styles.yAxisLabel}>10</Text>
              <Text style={styles.yAxisLabel}>5</Text>
              <Text style={styles.yAxisLabel}>0</Text>
            </View>

            <View style={styles.emptyChartContainer}>
              <Svg height={chartHeight} width={chartWidth}>
                {/* Empty chart background */}
                <Rect
                  x={0}
                  y={chartHeight - 20}
                  width={chartWidth}
                  height={1}
                  fill="#e5e7eb"
                />
              </Svg>
              <View style={styles.noDataOverlay}>
                <Ionicons name="bar-chart-outline" size={48} color="#d1d5db" />
                <Text style={styles.noDataText}>No vehicle data available</Text>
                <Text style={styles.noDataSubtext}>
                  Try selecting a different time period
                </Text>
              </View>
            </View>
          </View>

          {/* Empty stats */}
          <View style={styles.chartStats}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>Total Bookings</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>₱0</Text>
              <Text style={styles.statLabel}>Total Revenue</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>N/A</Text>
              <Text style={styles.statLabel}>Top Vehicle</Text>
            </View>
          </View>

          {/* Empty vehicle details */}
          <View style={styles.vehicleDetailsList}>
            <Text style={styles.detailsTitle}>Vehicle Performance</Text>
            <View style={styles.emptyDetailsContainer}>
              <Text style={styles.emptyDetailsText}>
                No vehicle performance data to display
              </Text>
            </View>
          </View>
        </View>
      );
    }

    // Render chart with data
    const maxBookings = Math.max(...chartData.map((d) => d.bookings), 1);
    const barWidth = chartWidth / chartData.length - 8;
    const maxBarHeight = chartHeight - 40;

    const totalBookings = chartData.reduce((sum, d) => sum + d.bookings, 0);
    const totalRevenue = chartData.reduce((sum, d) => sum + d.revenue, 0);
    const topVehicle = chartData[0];

    return (
      <View style={styles.chartContainer}>
        <View style={{ flexDirection: "row" }}>
          <View style={styles.yAxis}>
            <Text style={styles.yAxisLabel}>{maxBookings}</Text>
            <Text style={styles.yAxisLabel}>{Math.floor(maxBookings / 2)}</Text>
            <Text style={styles.yAxisLabel}>0</Text>
          </View>

          <Svg height={chartHeight} width={chartWidth}>
            {chartData.map((item, index) => {
              const barHeight = (item.bookings / maxBookings) * maxBarHeight;
              const x = index * (barWidth + 8);
              const y = chartHeight - barHeight - 20;

              const colors = [
                "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
                "#06b6d4", "#84cc16", "#f97316", "#ec4899", "#6b7280"
              ];

              return (
                <View key={item.id}>
                  <Rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    fill={colors[index % colors.length]}
                    rx={4}
                  />
                </View>
              );
            })}
          </Svg>
        </View>

        <View style={styles.xAxis}>
          {chartData.map((item, index) => (
            <View key={index} style={styles.xAxisLabelContainer}>
              <Text style={styles.xAxisLabel} numberOfLines={2}>
                {item.label}
              </Text>
              <Text style={styles.bookingCount}>{item.bookings}</Text>
            </View>
          ))}
        </View>

        <View style={styles.chartStats}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{totalBookings}</Text>
            <Text style={styles.statLabel}>Total Bookings</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>₱{totalRevenue.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Total Revenue</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber} numberOfLines={1}>
              {topVehicle ? topVehicle.name.substring(0, 12) + (topVehicle.name.length > 12 ? '...' : '') : 'N/A'}
            </Text>
            <Text style={styles.statLabel}>Top Vehicle</Text>
          </View>
        </View>

        {/* Vehicle Details List 
        <View style={styles.vehicleDetailsList}>
          <Text style={styles.detailsTitle}>Vehicle Performance</Text>
          {chartData.slice(0, 5).map((vehicle, index) => (
            <View key={vehicle.id} style={styles.vehicleDetailItem}>
              <View style={styles.vehicleRank}>
                <Text style={styles.rankNumber}>{index + 1}</Text>
              </View>
              <View style={styles.vehicleInfo}>
                <Text style={styles.vehicleName} numberOfLines={1}>
                  {vehicle.name}
                </Text>
                <View style={styles.vehicleStats}>
                  <Text style={styles.vehicleBookings}>{vehicle.bookings} bookings</Text>
                  <Text style={styles.vehicleRevenue}>₱{vehicle.revenue.toFixed(0)}</Text>
                </View>
              </View>
              <View style={styles.statusIndicators}>
                {vehicle.completedBookings > 0 && (
                  <View style={[styles.statusDot, { backgroundColor: '#10b981' }]} />
                )}
                {vehicle.confirmedBookings > 0 && (
                  <View style={[styles.statusDot, { backgroundColor: '#3b82f6' }]} />
                )}
                {vehicle.pendingBookings > 0 && (
                  <View style={[styles.statusDot, { backgroundColor: '#f59e0b' }]} />
                )}
              </View>
            </View>
          ))}
        </View>
        */}
      </View>
    );
  };

  return (
    <View style={styles.summaryCard}>
      <View style={styles.cardHeader}>
        <Text style={styles.sectionTitle}>Vehicle Analytics</Text>
        <Ionicons name="car-sport-outline" size={20} color="#6b7280" />
      </View>

      <View style={styles.overviewFilters}>
        <View style={styles.overviewFilterRow}>
          {["Today", "Weekly", "Monthly", "Yearly"].map((label) => (
            <TouchableOpacity
              key={label}
              onPress={() => setVehicleFilter(label)}
              style={[
                styles.overviewFilterButton,
                vehicleFilter === label && styles.overviewFilterButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.overviewFilterButtonText,
                  vehicleFilter === label && styles.overviewFilterButtonTextActive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.secondaryFilterRow}>
          <TouchableOpacity
            style={styles.secondaryFilterButton}
            onPress={() => setYearDropdownVisible(true)}
          >
            <Text style={styles.secondaryFilterButtonText}>{selectedYear}</Text>
            <Ionicons name="chevron-down" size={14} color="#6b7280" />
          </TouchableOpacity>

          {vehicleFilter === "Monthly" && (
            <TouchableOpacity
              style={styles.secondaryFilterButton}
              onPress={() => setMonthDropdownVisible(true)}
            >
              <Text style={styles.secondaryFilterButtonText}>
                {monthNames[selectedMonth]}
              </Text>
              <Ionicons name="chevron-down" size={14} color="#6b7280" />
            </TouchableOpacity>
          )}

          {vehicleFilter === "Weekly" && (
            <TouchableOpacity
              style={styles.secondaryFilterButton}
              onPress={() => setWeekDropdownVisible(true)}
            >
              <Text style={styles.secondaryFilterButtonText}>
                {selectedWeekRange
                  ? selectedWeekRange.label
                  : `${monthNames[selectedMonth]} weeks`}
              </Text>
              <Ionicons name="chevron-down" size={14} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {renderBarChart()}

      {/* Year Dropdown */}
      <Modal visible={yearDropdownVisible} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.modalOverlay}
          onPress={() => setYearDropdownVisible(false)}
        >
          <View style={styles.dropdownContainer}>
            <FlatList
              data={[2023, 2024, 2025]}
              keyExtractor={(item) => item.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    setSelectedYear(item);
                    setYearDropdownVisible(false);
                  }}
                >
                  <Text style={styles.dropdownText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Month Dropdown */}
      <Modal visible={monthDropdownVisible} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.modalOverlay}
          onPress={() => setMonthDropdownVisible(false)}
        >
          <View style={styles.dropdownContainer}>
            <FlatList
              data={monthNames}
              keyExtractor={(item, idx) => idx.toString()}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    setSelectedMonth(index);
                    setMonthDropdownVisible(false);
                  }}
                >
                  <Text style={styles.dropdownText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Week Dropdown */}
      <Modal visible={weekDropdownVisible} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.modalOverlay}
          onPress={() => setWeekDropdownVisible(false)}
        >
          <View style={styles.dropdownContainer}>
            <FlatList
              data={getWeekRanges()}
              keyExtractor={(item, idx) => idx.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    setSelectedWeekRange(item);
                    setWeekDropdownVisible(false);
                  }}
                >
                  <Text style={styles.dropdownText}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontWeight: "800",
    fontSize: 18,
    letterSpacing: -0.5,
  },
  overviewFilters: { marginBottom: 16 },
  overviewFilterRow: { flexDirection: "row", gap: 12 },
  overviewFilterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
  },
  overviewFilterButtonActive: { backgroundColor: "#3b82f6" },
  overviewFilterButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  overviewFilterButtonTextActive: { color: "white" },
  secondaryFilterRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  secondaryFilterButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    backgroundColor: "#f9fafb",
    gap: 4,
  },
  secondaryFilterButtonText: { fontSize: 14, fontWeight: "500" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  dropdownContainer: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    width: "80%",
    maxHeight: "60%",
  },
  dropdownItem: { padding: 12 },
  dropdownText: { fontSize: 16, fontWeight: "500" },
  chartContainer: {
    marginTop: 16,
  },
  yAxis: {
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginRight: 6,
    height: 200,
  },
  yAxisLabel: {
    fontSize: 10,
    color: "#6b7280",
  },
  xAxis: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingHorizontal: 4,
  },
  xAxisLabelContainer: {
    alignItems: "center",
    flex: 1,
    paddingHorizontal: 2,
  },
  xAxisLabel: {
    fontSize: 9,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 2,
  },
  bookingCount: {
    fontSize: 10,
    fontWeight: "600",
    color: "#374151",
    textAlign: "center",
  },
  chartStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    paddingHorizontal: 8,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  statLabel: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 2,
    textAlign: "center",
  },
  vehicleDetailsList: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  vehicleDetailItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  vehicleRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  rankNumber: {
    fontSize: 12,
    fontWeight: "600",
    color: "white",
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  vehicleStats: {
    flexDirection: "row",
    gap: 12,
  },
  vehicleBookings: {
    fontSize: 12,
    color: "#6b7280",
  },
  vehicleRevenue: {
    fontSize: 12,
    color: "#10b981",
    fontWeight: "500",
  },
  statusIndicators: {
    flexDirection: "row",
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  // New styles for empty state
  emptyChartContainer: {
    position: 'relative',
    flex: 1,
  },
  noDataOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 20,
  },
  noDataText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9ca3af',
    marginTop: 12,
    textAlign: 'center',
  },
  noDataSubtext: {
    fontSize: 12,
    color: '#d1d5db',
    marginTop: 4,
    textAlign: 'center',
  },
  emptyDetailsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyDetailsText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
});