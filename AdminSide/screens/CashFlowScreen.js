import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function CashFlowScreen() {
  const [transactions, setTransactions] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [newTransaction, setNewTransaction] = useState({
    type: 'income', // 'income' or 'expense'
    amount: '',
    description: '',
    category: '',
    date: new Date().toISOString().split('T')[0]
  });

  const incomeCategories = ['Rental Payment', 'Late Fee', 'Damage Fee', 'Other Income'];
  const expenseCategories = ['Maintenance', 'Fuel', 'Insurance', 'Marketing', 'Office Supplies', 'Other Expense'];

  useEffect(() => {
    const q = query(
      collection(db, 'transactions'),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const transactionsList = [];
      querySnapshot.forEach((doc) => {
        transactionsList.push({
          id: doc.id,
          ...doc.data()
        });
      });
      setTransactions(transactionsList);
    });

    return () => unsubscribe();
  }, []);

  const getMonthlyData = () => {
    const monthStart = new Date(selectedYear, selectedMonth, 1);
    const monthEnd = new Date(selectedYear, selectedMonth + 1, 0);
    
    const monthlyTransactions = transactions.filter(transaction => {
      const transactionDate = new Date(transaction.date);
      return transactionDate >= monthStart && transactionDate <= monthEnd;
    });

    const income = monthlyTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const expenses = monthlyTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const netProfit = income - expenses;

    return { income, expenses, netProfit, monthlyTransactions };
  };

  const addTransaction = async () => {
    if (!newTransaction.amount || !newTransaction.description || !newTransaction.category) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      await addDoc(collection(db, 'transactions'), {
        ...newTransaction,
        amount: parseFloat(newTransaction.amount),
        createdAt: new Date().toISOString()
      });

      setNewTransaction({
        type: 'income',
        amount: '',
        description: '',
        category: '',
        date: new Date().toISOString().split('T')[0]
      });
      setModalVisible(false);
      Alert.alert('Success', 'Transaction added successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to add transaction');
    }
  };

  const { income, expenses, netProfit, monthlyTransactions } = getMonthlyData();

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const renderTransactionItem = ({ item }) => (
    <View style={styles.transactionItem}>
      <View style={styles.transactionHeader}>
        <View style={styles.transactionInfo}>
          <Text style={styles.transactionDescription}>{item.description}</Text>
          <Text style={styles.transactionCategory}>{item.category}</Text>
          <Text style={styles.transactionDate}>
            {new Date(item.date).toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.transactionAmount}>
          <Text style={[
            styles.amountText,
            { color: item.type === 'income' ? '#4CAF50' : '#F44336' }
          ]}>
            {item.type === 'income' ? '+' : '-'}${item.amount}
          </Text>
          <Ionicons 
            name={item.type === 'income' ? 'arrow-up' : 'arrow-down'} 
            size={16} 
            color={item.type === 'income' ? '#4CAF50' : '#F44336'} 
          />
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cash Flow Management</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Month Selector */}
        <View style={styles.periodSelector}>
          <TouchableOpacity 
            style={styles.periodButton}
            onPress={() => setSelectedMonth(selectedMonth > 0 ? selectedMonth - 1 : 11)}
          >
            <Ionicons name="chevron-back" size={20} color="#FF6B35" />
          </TouchableOpacity>
          
          <Text style={styles.periodText}>
            {months[selectedMonth]} {selectedYear}
          </Text>
          
          <TouchableOpacity 
            style={styles.periodButton}
            onPress={() => setSelectedMonth(selectedMonth < 11 ? selectedMonth + 1 : 0)}
          >
            <Ionicons name="chevron-forward" size={20} color="#FF6B35" />
          </TouchableOpacity>
        </View>

        {/* Financial Summary */}
        <View style={styles.summarySection}>
          <View style={styles.summaryCard}>
            <View style={[styles.summaryItem, styles.incomeItem]}>
              <Ionicons name="arrow-up" size={24} color="#4CAF50" />
              <View style={styles.summaryText}>
                <Text style={styles.summaryLabel}>Total Income</Text>
                <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>
                  ${income.toFixed(2)}
                </Text>
              </View>
            </View>

            <View style={[styles.summaryItem, styles.expenseItem]}>
              <Ionicons name="arrow-down" size={24} color="#F44336" />
              <View style={styles.summaryText}>
                <Text style={styles.summaryLabel}>Total Expenses</Text>
                <Text style={[styles.summaryValue, { color: '#F44336' }]}>
                  ${expenses.toFixed(2)}
                </Text>
              </View>
            </View>

            <View style={[styles.summaryItem, styles.profitItem]}>
              <Ionicons 
                name={netProfit >= 0 ? "trending-up" : "trending-down"} 
                size={24} 
                color={netProfit >= 0 ? "#4CAF50" : "#F44336"} 
              />
              <View style={styles.summaryText}>
                <Text style={styles.summaryLabel}>Net Profit</Text>
                <Text style={[
                  styles.summaryValue, 
                  { color: netProfit >= 0 ? "#4CAF50" : "#F44336" }
                ]}>
                  ${netProfit.toFixed(2)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Recent Transactions */}
        <View style={styles.transactionsSection}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <FlatList
            data={monthlyTransactions.slice(0, 10)}
            renderItem={renderTransactionItem}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </ScrollView>

      {/* Add Transaction Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Transaction</Text>
              <TouchableOpacity 
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              {/* Transaction Type */}
              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    newTransaction.type === 'income' && styles.selectedTypeButton
                  ]}
                  onPress={() => setNewTransaction({ ...newTransaction, type: 'income' })}
                >
                  <Ionicons name="arrow-up" size={20} color={newTransaction.type === 'income' ? '#fff' : '#4CAF50'} />
                  <Text style={[
                    styles.typeButtonText,
                    newTransaction.type === 'income' && styles.selectedTypeButtonText
                  ]}>
                    Income
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    newTransaction.type === 'expense' && styles.selectedTypeButton
                  ]}
                  onPress={() => setNewTransaction({ ...newTransaction, type: 'expense' })}
                >
                  <Ionicons name="arrow-down" size={20} color={newTransaction.type === 'expense' ? '#fff' : '#F44336'} />
                  <Text style={[
                    styles.typeButtonText,
                    newTransaction.type === 'expense' && styles.selectedTypeButtonText
                  ]}>
                    Expense
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Amount */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Amount ($)</Text>
                <TextInput
                  style={styles.input}
                  value={newTransaction.amount}
                  onChangeText={(text) => setNewTransaction({ ...newTransaction, amount: text })}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                />
              </View>

              {/* Description */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={styles.input}
                  value={newTransaction.description}
                  onChangeText={(text) => setNewTransaction({ ...newTransaction, description: text })}
                  placeholder="Enter description"
                />
              </View>

              {/* Category */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {(newTransaction.type === 'income' ? incomeCategories : expenseCategories).map((category) => (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.categoryButton,
                        newTransaction.category === category && styles.selectedCategoryButton
                      ]}
                      onPress={() => setNewTransaction({ ...newTransaction, category })}
                    >
                      <Text style={[
                        styles.categoryButtonText,
                        newTransaction.category === category && styles.selectedCategoryButtonText
                      ]}>
                        {category}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Date */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Date</Text>
                <TextInput
                  style={styles.input}
                  value={newTransaction.date}
                  onChangeText={(text) => setNewTransaction({ ...newTransaction, date: text })}
                  placeholder="YYYY-MM-DD"
                />
              </View>

              <TouchableOpacity style={styles.submitButton} onPress={addTransaction}>
                <Text style={styles.submitButtonText}>Add Transaction</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    backgroundColor: '#FF6B35',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  periodSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  periodButton: {
    padding: 8,
  },
  periodText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginHorizontal: 20,
  },
  summarySection: {
    padding: 20,
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  summaryText: {
    marginLeft: 16,
    flex: 1,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  transactionsSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  transactionItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  transactionCategory: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: '#999',
  },
  transactionAmount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  modalForm: {
    padding: 20,
  },
  typeSelector: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginHorizontal: 4,
  },
  selectedTypeButton: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  typeButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#666',
  },
  selectedTypeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 8,
    backgroundColor: '#fff',
  },
  selectedCategoryButton: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  categoryButtonText: {
    fontSize: 14,
    color: '#666',
  },
  selectedCategoryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  submitButton: {
    backgroundColor: '#FF6B35',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
