import React from "react"
import { View, Text, TouchableOpacity, Modal, StyleSheet } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { vehiclesService } from "../../services/firebaseService"

export default function DeleteVehicleModal({
  visible,
  vehicle,
  onClose,
  onDeleted,
}) {
  const [deleting, setDeleting] = React.useState(false)

  const confirmDeleteVehicle = async () => {
    if (!vehicle) return

    setDeleting(true)
    try {
      await vehiclesService.delete(vehicle.id)
      alert("Vehicle deleted successfully")
      onClose()
      if (onDeleted) onDeleted(vehicle.id)
    } catch (error) {
      console.error("Error in confirmDeleteVehicle:", error)
      alert("Failed to delete vehicle")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modalIconContainer}>
              <Ionicons name="warning" size={32} color="#ef4444" />
            </View>
            <Text style={styles.modalTitle}>Delete Vehicle</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to delete{" "}
              <Text style={styles.modalVehicleName}>
                {vehicle?.make} {vehicle?.model}
              </Text>
              ? This action cannot be undone and will also delete all associated
              color variants.
            </Text>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={onClose}
              disabled={deleting}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modalDeleteButton,
                deleting && styles.modalButtonDisabled,
              ]}
              onPress={confirmDeleteVehicle}
              disabled={deleting}
            >
              {deleting ? (
                <Text style={styles.modalDeleteText}>Deleting...</Text>
              ) : (
                <>
                  <Ionicons name="trash" size={16} color="white" />
                  <Text style={styles.modalDeleteText}>Delete</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
  },
  modalHeader: {
    marginBottom: 20,
  },
  modalIconContainer: {
    alignSelf: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: "#374151",
    textAlign: "center",
    lineHeight: 20,
  },
  modalVehicleName: {
    fontWeight: "700",
    color: "#111827",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  modalCancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  modalDeleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#ef4444",
  },
  modalDeleteText: {
    fontSize: 14,
    fontWeight: "600",
    color: "white",
    marginLeft: 6,
  },
  modalButtonDisabled: {
    opacity: 0.7,
  },
})
