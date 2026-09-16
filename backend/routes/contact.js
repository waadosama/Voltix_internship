import { Router } from 'express';
import { Inquiry } from '../models/inquiry.js';
<<<<<<< HEAD
import { optionalAuth } from '../middleware/auth.js';
=======
>>>>>>> 840a98e1db163fdf58b10f72aa48550735a92727

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validateInquiry(body) {
  const name = asTrimmedString(body?.name);
  const email = asTrimmedString(body?.email);
  const subject = asTrimmedString(body?.subject);
  const message = asTrimmedString(body?.message);
  const errors = [];

  if (!name) errors.push('Name is required.');
  if (!email) errors.push('Email is required.');
  else if (!emailPattern.test(email)) errors.push('Please enter a valid email.');
  if (!subject) errors.push('Subject is required.');
  if (!message) errors.push('Message is required.');

  return {
    errors,
    data: { name, email, subject, message }
  };
}

export const contactRouter = Router();

<<<<<<< HEAD
contactRouter.post('/', optionalAuth, async (request, response) => {
=======
contactRouter.post('/', async (request, response) => {
>>>>>>> 840a98e1db163fdf58b10f72aa48550735a92727
  const { errors, data } = validateInquiry(request.body);

  if (errors.length > 0) {
    return response.status(400).json({
      message: errors.join(' ')
    });
  }

  try {
    const inquiry = await Inquiry.create(data);

    return response.status(201).json({
      message: 'Thanks. Your inquiry has been received.',
      inquiry: {
        id: inquiry.id,
        name: inquiry.name,
        email: inquiry.email,
        subject: inquiry.subject,
        message: inquiry.message
      }
    });
  } catch (error) {
    console.error('Failed to store inquiry:', error);

    return response.status(500).json({
      message: 'Your inquiry could not be saved. Please try again.'
    });
  }
});
