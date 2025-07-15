import { createContext, useContext } from 'react';

export const TransactionContext = createContext({
  transactions: [],
  addTransaction: (tx: any) => {},
});

export const useTransactions = () => useContext(TransactionContext);