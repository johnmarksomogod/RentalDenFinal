import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { firebaseAuth } from '../services/firebaseService';
import NetInfo from '@react-native-community/netinfo';

const { height } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

export default function LoginScreen({ navigation }) {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  // 🚀 Handle login
  const handleLogin = async () => {
    if (!formData.email || !formData.password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        Alert.alert('No Internet', 'Check your connection and try again.');
        return;
      }

      const cred = await firebaseAuth.signInWithPassword(
        formData.email.trim(),
        formData.password,
      );
      if (cred?.user) {
        console.log('Login success:', cred.user);
        // Auth state listener in App.js will redirect
      }
    } catch (err) {
      let errorMessage = 'Login failed. Please try again.';
      if (err?.message?.includes('auth/invalid-credential') || err?.message?.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password.';
      } else if (err?.message) {
        errorMessage = err.message;
      }
      Alert.alert('Login Error', errorMessage);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 🚀 Handle forgot password (single clear method)
  const handleForgotPassword = async () => {
    if (!formData.email) {
      Alert.alert('Error', 'Please enter your email first.');
      return;
    }

    setResetLoading(true);
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        Alert.alert('No Internet', 'Check your connection and try again.');
        return;
      }

      await firebaseAuth.resetPasswordForEmail(formData.email.trim());
      Alert.alert(
        'Reset Link Sent',
        `A password reset link has been sent to ${formData.email}. Check your inbox.`
      );
    } catch (err) {
      Alert.alert('Error', 'Unexpected error occurred.');
      console.error(err);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContainer, isWeb && styles.scrollContainerWeb]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.content, isWeb && styles.contentWeb]}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <Image 
                  source={require('../assets/logo/logoRental.png')} 
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.title}>Welcome Back</Text>
              <Text style={styles.subtitle}>Sign in to access your dashboard</Text>
            </View>

            {/* Login Form */}
            <View style={styles.form}>
              {/* Email */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email Address</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={formData.email}
                    onChangeText={(text) => setFormData({ ...formData, email: text })}
                    placeholder="Enter your email"
                    placeholderTextColor="#6b7280"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              {/* Password */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={formData.password}
                    onChangeText={(text) => setFormData({ ...formData, password: text })}
                    placeholder="Enter your password"
                    placeholderTextColor="#6b7280"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                    <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#9ca3af" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Sign In Button */}
              <TouchableOpacity
                style={[styles.loginButton, loading && styles.disabledButton]}
                onPress={handleLogin}
                disabled={loading}
              >
                <Text style={styles.loginButtonText}>
                  {loading ? 'Signing In...' : 'Sign In'}
                </Text>
              </TouchableOpacity>

              {/* Forgot Password */}
              <View style={styles.forgotPasswordContainer}>
                <TouchableOpacity 
                  onPress={handleForgotPassword}
                  disabled={resetLoading}
                  style={styles.forgotPasswordButton}
                >
                  <Text style={[styles.forgotPasswordText, resetLoading && styles.disabledText]}>
                    {resetLoading ? 'Sending...' : 'Forgot Password?'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  // same as your existing styles...
  container: { flex: 1, backgroundColor: '#000' },
  keyboardContainer: { flex: 1 },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  scrollContainerWeb: { minHeight: height, justifyContent: 'center', alignItems: 'center' },
  content: { width: '100%' },
  contentWeb: { maxWidth: 400, width: '100%' },
  header: { alignItems: 'center', marginBottom: 40 },
  logoContainer: { width: 120, height: 120, marginBottom: 32 },
  logo: { width: 120, height: 120 },
  title: { fontSize: 32, fontWeight: '800', color: 'white', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#9ca3af' },
  form: { marginBottom: 30 },
  inputGroup: { marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', color: 'white', marginBottom: 8 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 2, borderColor: '#374151',
    borderRadius: 16, backgroundColor: '#111827',
  },
  inputIcon: { marginLeft: 16, marginRight: 12 },
  input: { flex: 1, paddingVertical: 16, paddingRight: 16, fontSize: 16, color: 'white' },
  eyeIcon: { padding: 16 },
  loginButton: {
    backgroundColor: 'white', paddingVertical: 20, borderRadius: 16, alignItems: 'center', marginTop: 24,
  },
  loginButtonText: { color: 'black', fontSize: 18, fontWeight: '800' },
  disabledButton: { opacity: 0.6 },
  forgotPasswordContainer: { alignItems: 'center', marginTop: 24 },
  forgotPasswordButton: { paddingHorizontal: 16, paddingVertical: 8 },
  forgotPasswordText: { color: '#60a5fa', fontSize: 14, fontWeight: '600' },
  disabledText: { color: '#6b7280' },
});
