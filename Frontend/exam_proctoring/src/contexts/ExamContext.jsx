// frontend/src/contexts/ExamContext.js
import React, { createContext, useContext, useState } from 'react';

const ExamContext = createContext();

export const useExam = () => {
  const context = useContext(ExamContext);
  if (!context) {
    throw new Error('useExam must be used within an ExamProvider');
  }
  return context;
};

export const ExamProvider = ({ children }) => {
  const [currentExam, setCurrentExam] = useState(null);
  const [currentAttempt, setCurrentAttempt] = useState(null);
  const [examAnswers, setExamAnswers] = useState({});

  const updateAnswer = (questionId, answer) => {
    setExamAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const clearExamData = () => {
    setCurrentExam(null);
    setCurrentAttempt(null);
    setExamAnswers({});
  };

  const value = {
    currentExam,
    setCurrentExam,
    currentAttempt,
    setCurrentAttempt,
    examAnswers,
    updateAnswer,
    clearExamData
  };

  return (
    <ExamContext.Provider value={value}>
      {children}
    </ExamContext.Provider>
  );
};
