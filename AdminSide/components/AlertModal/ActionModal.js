import React, { useEffect } from "react"
import { View, Text, TouchableOpacity, Modal, StyleSheet } from "react-native"
import { Ionicons } from "@expo/vector-icons"

export default function ActionModal({
  visible,
  type = "confirm", // "confirm" | "delete" | "success"
  title,
  message,
  confirmText,
  cancelText = "Cancel",
  onClose,
  onConfirm,
  loading = false,
}) {
  // Defaults based on type
  const defaults = {
    confirm: {
      title: "Confirm Action",
      message: "Are you sure you want to continue?",
      confirmText: "Confirm",
      icon: <Ionicons name="help-circle" size={32} color="black" />,
      confirmColor: "black",
    },
    delete: {
      title: "Delete Item",
      message: "This action cannot be undone. Proceed?",
      confirmText: "Delete",
      icon: <Ionicons name="trash" size={32} color="black" />,
      confirmColor: "black",
    },
    success: {
      title: "Success",
      message: "Your action was completed successfully!",
      confirmText: "OK",
      icon: <Ionicons name="checkmark-circle" size={32} color="black" />,
      confirmColor: "black",
    },
    error: {
      title: "Error",
      message: "Something went wrong.",
      confirmText: "Close",
      icon: <Ionicons name="alert-circle" size={32} color="black" />,
      confirmColor: "black",
    },
  }

  const config = defaults[type]

  // Auto-close for success modal
  useEffect(() => {
    if (visible && type === "success") {
      const timer = setTimeout(() => {
        onClose()
      }, 1500) // auto-close after 1.5s

      return () => clearTimeout(timer)
    }
  }, [visible, type, onClose])

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modalIconContainer}>{config.icon}</View>
            <Text style={styles.modalTitle}>{title || config.title}</Text>
            <Text style={styles.modalMessage}>{message || config.message}</Text>
          </View>

          {/* Show buttons only if NOT success */}
          {type !== "success" && (
            <View style={styles.modalActions}>
              {type !== "error" && (
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.modalCancelText}>{cancelText}</Text>
            </TouchableOpacity>
          )}

              <TouchableOpacity
                style={[
                  styles.modalConfirmButton,
                  { backgroundColor: config.confirmColor },
                  loading && styles.modalButtonDisabled,
                ]}
                onPress={onConfirm}
                disabled={loading}
              >
                {loading ? (
                  <Text style={styles.modalConfirmText}>Please wait...</Text>
                ) : (
                  <>
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color="white"
                    />
                    <Text style={styles.modalConfirmText}>
                      {confirmText || config.confirmText}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
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
    textAlign: "center",
    marginBottom: 8,
    color: "#111827",
  },
  modalMessage: {
    fontSize: 14,
    color: "#374151",
    textAlign: "center",
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
  modalConfirmButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: "600",
    color: "white",
    marginLeft: 6,
  },
  modalButtonDisabled: {
    opacity: 0.7,
  },
})
