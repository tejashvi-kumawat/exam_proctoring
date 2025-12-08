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

  const submitAnswer = async (attemptId, questionId, selectedOptionId = null, answerText = '', images = [], attachments = []) => {
    try {
      // Use FormData for multipart/form-data if images or attachments are present
      if ((images && images.length > 0) || (attachments && attachments.length > 0)) {
        const formData = new FormData();
        formData.append('question_id', questionId);
        // Only append selected_option_id if it's not null/undefined
        if (selectedOptionId !== null && selectedOptionId !== undefined) {
          formData.append('selected_option_id', selectedOptionId);
        }
        if (answerText) formData.append('answer_text', answerText);
        
        // Append images
        if (images && images.length > 0) {
          images.forEach((image) => {
            formData.append('images', image);
          });
        }
        
        // Append attachments
        if (attachments && attachments.length > 0) {
          attachments.forEach((attachment) => {
            formData.append('attachments', attachment);
          });
        }
        
        const response = await api.post(`/exam/attempts/${attemptId}/submit-answer/`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        return response.data;
      } else {
        // Regular JSON request - only include selected_option_id if it's not null
        const payload = {
          question_id: questionId,
          answer_text: answerText || ''
        };
        // Only add selected_option_id if it's not null/undefined
        if (selectedOptionId !== null && selectedOptionId !== undefined) {
          payload.selected_option_id = selectedOptionId;
        }
        const response = await api.post(`/exam/attempts/${attemptId}/submit-answer/`, payload);
        return response.data;
      }
    } catch (err) {
      console.error('Error submitting answer:', err);
      throw err;
    }
  };

  const pauseExam = async (attemptId) => {
    try {
      const response = await api.post(`/exam/attempts/${attemptId}/pause/`);
      return response.data;
    } catch (err) {
      console.error('Error pausing exam:', err);
      throw err;
    }
  };

  const resumeExam = async (attemptId) => {
    try {
      const response = await api.post(`/exam/attempts/${attemptId}/resume/`);
      return response.data;
    } catch (err) {
      console.error('Error resuming exam:', err);
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
    return response.data;
  } catch (err) {
    throw err;
  }
};
  const restartExam = async (attemptId) => {
    try {
      const response = await api.post(`/exam/admin/attempts/${attemptId}/restart/`);
      return response.data;
    } catch (err) {
      console.error('Error restarting exam:', err);
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
    getExamResults,
    pauseExam,
    resumeExam,
    restartExam
  };
};
