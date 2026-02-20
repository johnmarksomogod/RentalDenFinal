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
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { bookingsService } from "../../services/firebaseService";

const { width } = Dimensions.get("window");

const monthNames = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

export default function RevenueOverviewChart() {
  const [revenueFilter, setRevenueFilter] = useState("Weekly");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedWeekRange, setSelectedWeekRange] = useState(null);

  const [yearDropdownVisible, setYearDropdownVisible] = useState(false);
  const [monthDropdownVisible, setMonthDropdownVisible] = useState(false);
  const [weekDropdownVisible, setWeekDropdownVisible] = useState(false);

  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    fetchRevenueData();
  }, [revenueFilter, selectedYear, selectedMonth, selectedWeekRange]);

  const fetchRevenueData = async () => {
    try {
      let startDate, endDate;

      if (revenueFilter === "Today") {
        startDate = new Date(selectedYear, selectedMonth, new Date().getDate());
        endDate = new Date(startDate);
      } else if (revenueFilter === "Weekly") {
        const now = new Date();
        const firstDay = now.getDate() - now.getDay() + 1;
        startDate = new Date(now.setDate(firstDay));
        endDate = new Date(now.setDate(firstDay + 6));
      } else if (revenueFilter === "Monthly") {
        startDate = new Date(selectedYear, selectedMonth, 1);
        endDate = new Date(selectedYear, selectedMonth + 1, 0);
      } else {
        startDate = new Date(selectedYear, 0, 1);
        endDate = new Date(selectedYear, 11, 31);
      }

      const allBookings = await bookingsService.list();
      const data = allBookings.filter(
        (b) =>
          b.status === "completed" &&
          b.rental_start_date >= startDate.toISOString().split("T")[0] &&
          b.rental_start_date <= endDate.toISOString().split("T")[0]
      );

      let grouped = [];
      if (revenueFilter === "Today") {
        grouped = Array.from({ length: 24 }, (_, i) => ({
          label: `${i}h`,
          revenue: data
            .filter((b) => new Date(b.rental_start_date).getHours() === i)
            .reduce((sum, b) => sum + Number(b.total_price), 0),
        }));
      } else if (revenueFilter === "Weekly") {
        const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        grouped = days.map((d, i) => {
          const target = new Date(startDate);
          target.setDate(startDate.getDate() + i);
          const dayStr = target.toISOString().split("T")[0];

          return {
            label: d,
            revenue: data
              .filter((b) => b.rental_start_date === dayStr)
              .reduce((sum, b) => sum + Number(b.total_price), 0),
          };
        });
      } else if (revenueFilter === "Monthly") {
        const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
        grouped = Array.from({ length: daysInMonth }, (_, i) => {
          const dayStr = new Date(selectedYear, selectedMonth, i + 1)
            .toISOString().split("T")[0];

          return {
            label: `${i + 1}`,
            revenue: data
              .filter((b) => b.rental_start_date === dayStr)
              .reduce((sum, b) => sum + Number(b.total_price), 0),
          };
        });
      } else {
        grouped = monthNames.map((m, i) => {
          return {
            label: m.slice(0, 3),
            revenue: data
              .filter((b) => new Date(b.rental_start_date).getMonth() === i)
              .reduce((sum, b) => sum + Number(b.total_price), 0),
          };
        });
      }

      setChartData(grouped);
    } catch (err) {
      console.error("Error fetching revenue data:", err);
    }
  };

  const getTrendColor = () => {
    if (chartData.length < 2) return "#6b7280";
    const recent = chartData.slice(-2);
    return recent[1].revenue > recent[0].revenue ? "#10b981" : "#ef4444";
  };

  const getTrendPercentage = () => {
    if (chartData.length < 2) return "0%";
    const recent = chartData.slice(-2);
    if (recent[0].revenue === 0) return recent[1].revenue > 0 ? "+100%" : "0%";
    const percentage = ((recent[1].revenue - recent[0].revenue) / recent[0].revenue) * 100;
    return percentage > 0 ? `+${percentage.toFixed(1)}%` : `${percentage.toFixed(1)}%`;
  };

  const getWeekRanges = () => {
    const year = selectedYear;
    const month = selectedMonth;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const weeks = [];
    let currentWeekStart = new Date(firstDay);
    
    // Find the Monday of the first week
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

  const renderLineChart = () => {
    if (chartData.length === 0) return null;

    const maxRevenue = Math.max(...chartData.map((d) => d.revenue), 1);
    const chartHeight = 140;
    const chartWidth = width - 64;
    const stepX = chartWidth / (chartData.length - 1);

    const points = chartData.map((d, i) => {
      const x = i * stepX;
      const y = chartHeight - (d.revenue / maxRevenue) * chartHeight;
      return { ...d, x, y };
    });

    const pathData = points
      .map((p, i) => (i === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`))
      .join(" ");

    const totalRevenue = chartData.reduce((sum, d) => sum + d.revenue, 0);
    const averageRevenue = totalRevenue / chartData.length;
    const trendPercentage = getTrendPercentage();

    return (
      <View style={styles.chartContainer}>
        <View style={{ flexDirection: "row" }}>
          <View style={styles.yAxis}>
            <Text style={styles.yAxisLabel}>₱{maxRevenue.toFixed(0)}</Text>
            <Text style={styles.yAxisLabel}>₱{Math.floor(maxRevenue / 2)}</Text>
            <Text style={styles.yAxisLabel}>₱0</Text>
          </View>

          <Svg height={chartHeight + 20} width={chartWidth}>
            <Defs>
              <LinearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#10b981" stopOpacity="1" />
                <Stop offset="1" stopColor="#10b981" stopOpacity="0.2" />
              </LinearGradient>
            </Defs>

            <Path d={pathData} fill="none" stroke="url(#revenueGradient)" strokeWidth={3} />

            {points.map((p, i) => (
              <Circle key={i} cx={p.x} cy={p.y} r={4} fill="#10b981" />
            ))}
          </Svg>
        </View>

        <View style={styles.xAxis}>
          {points.map((p, i) => (
            <Text key={i} style={styles.xAxisLabel}>
              {p.label}
            </Text>
          ))}
        </View>

        <View style={styles.chartStats}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>₱{totalRevenue.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Total Revenue</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>₱{averageRevenue.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Average Revenue</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: getTrendColor() }]}>
              {trendPercentage}
            </Text>
            <Text style={styles.statLabel}>Trend</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.summaryCard}>
      <View style={styles.cardHeader}>
        <Text style={styles.sectionTitle}>Revenue Overview</Text>
        <Text style={[styles.trendText, { color: getTrendColor() }]}>
          {getTrendPercentage()}
        </Text>
      </View>

      <View style={styles.overviewFilters}>
        <View style={styles.overviewFilterRow}>
          {["Today", "Weekly", "Monthly", "Yearly"].map((label) => (
            <TouchableOpacity
              key={label}
              onPress={() => setRevenueFilter(label)}
              style={[
                styles.overviewFilterButton,
                revenueFilter === label && styles.overviewFilterButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.overviewFilterButtonText,
                  revenueFilter === label && styles.overviewFilterButtonTextActive,
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

          {revenueFilter === "Monthly" && (
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

          {revenueFilter === "Weekly" && (
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

      {renderLineChart()}

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
  trendText: {
    fontWeight: "600",
    fontSize: 14,
  },
  overviewFilters: { marginBottom: 16 },
  overviewFilterRow: { flexDirection: "row", gap: 12 },
  overviewFilterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
  },
  overviewFilterButtonActive: { backgroundColor: "#10b981" },
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
    height: 140,
  },
  yAxisLabel: {
    fontSize: 10,
    color: "#6b7280",
  },
  xAxis: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  xAxisLabel: {
    fontSize: 10,
    color: "#6b7280",
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
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  statLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
});