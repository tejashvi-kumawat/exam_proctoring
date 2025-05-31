// frontend/src/hooks/useExam.js
import { useState, useEffect } from 'react';
import api from '../services/api';

export const useExam = () => {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchExams = async () => {
    setLoading(true);
    try {
      const response = await api.get('/exam/exams/');
      setExams(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch exams');
      console.error('Error fetching exams:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchExamById = async (examId) => {
    try {
      const response = await api.get(`/exam/exams/${examId}/`);
      return response.data;
    } catch (err) {
      console.error('Error fetching exam:', err);
      throw err;
    }
  };

  const startExam = async (examId) => {
    try {
      const response = await api.post(`/exam/exams/${examId}/start/`);
      return response.data;
    } catch (err) {
      console.error('Error starting exam:', err);
      throw err;
    }
  };

  const submitAnswer = async (attemptId, questionId, selectedOptionId, answerText = '') => {
    try {
      const response = await api.post(`/exam/attempts/${attemptId}/submit-answer/`, {
        question_id: questionId,
        selected_option_id: selectedOptionId,
        answer_text: answerText
      });
      return response.data;
    } catch (err) {
      console.error('Error submitting answer:', err);
      throw err;
    }
  };

  const submitExam = async (attemptId) => {
    try {
      const response = await api.post(`/exam/attempts/${attemptId}/submit/`);
      return response.data;
    } catch (err) {
      console.error('Error submitting exam:', err);
      throw err;
    }
  };

const getExamResults = async (attemptId) => {
  try {
    const response = await api.get(`/exam/attempts/${attemptId}/results/`);
    console.log('API response:', response.data); // Debug log
    return response.data;
  } catch (err) {
    console.error('Error fetching results:', err);
    throw err;
  }
};


  useEffect(() => {
    fetchExams();
  }, []);

  return {
    exams,
    loading,
    error,
    fetchExams,
    fetchExamById,
    startExam,
    submitAnswer,
    submitExam,
    getExamResults
  };
};
