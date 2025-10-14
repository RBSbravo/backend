const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { FileAttachment, User, Ticket, Task, Department } = require('../models');
const { body, param } = require('express-validator');
const notificationService = require('../services/notificationService');

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // For task and ticket uploads, restrict to PDF and images only
    if (req.route.path.includes('/task/') || req.route.path.includes('/ticket/')) {
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/bmp'
      ];
      
      if (!allowedTypes.includes(file.mimetype)) {
        const entityType = req.route.path.includes('/task/') ? 'tasks' : 'tickets';
        return cb(new Error(`Only PDF and image files are allowed for ${entityType}`), false);
      }
    }
    
    cb(null, true);
  }
});

// Upload file for ticket
router.post(
  '/ticket/:ticketId',
  authenticateToken,
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        if (err.message.includes('Only PDF and image files are allowed')) {
          return res.status(400).json({ error: err.message });
        }
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File size too large. Maximum size is 10MB.' });
        }
        return res.status(400).json({ error: 'File upload error: ' + err.message });
      }
      next();
    });
  },
  param('ticketId').isString().matches(/^TKT-\d{8}-\d{5}$/),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const fileAttachment = await FileAttachment.create({
        ticket_id: req.params.ticketId,
        file_name: req.file.originalname,
        file_path: req.file.path,
        file_type: req.file.mimetype,
        file_size: req.file.size,
        uploaded_by: req.user.id
      });

      // Notify department head and assignee (don't fail upload if notifications fail)
      try {
        const ticket = await Ticket.findByPk(req.params.ticketId, { include: [{ model: Department }, { model: User, as: 'assignee' }] });
        if (ticket && ticket.department_id) {
          const deptHead = await User.findOne({ where: { departmentId: ticket.department_id, role: 'department_head' } });
          if (deptHead && deptHead.id !== req.user.id) {
            await notificationService.createNotification({
              userId: deptHead.id,
              type: 'file_uploaded',
              title: 'File Uploaded',
              message: `A new file was uploaded to ticket: ${ticket.title}`,
              ticketId: ticket.id
            });
          }
        }
        if (ticket && ticket.assigned_to && ticket.assigned_to !== req.user.id) {
          await notificationService.createNotification({
            userId: ticket.assigned_to,
            type: 'file_uploaded',
            title: 'File Uploaded',
            message: `A new file was uploaded to ticket: ${ticket.title}`,
            ticketId: ticket.id
          });
        }
      } catch (notificationError) {
        console.error('Error creating notifications for file upload:', notificationError);
        // Don't fail the file upload if notifications fail
      }

      res.status(201).json(fileAttachment);
    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).json({ error: 'Error uploading file' });
    }
  }
);

// Upload file for task
router.post(
  '/task/:taskId',
  authenticateToken,
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        if (err.message === 'Only PDF and image files are allowed for tasks') {
          return res.status(400).json({ error: err.message });
        }
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File size too large. Maximum size is 10MB.' });
        }
        return res.status(400).json({ error: 'File upload error: ' + err.message });
      }
      next();
    });
  },
  param('taskId').isString().matches(/^TSK-\d{8}-\d{5}$/),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const fileAttachment = await FileAttachment.create({
        task_id: req.params.taskId,
        file_name: req.file.originalname,
        file_path: req.file.path,
        file_type: req.file.mimetype,
        file_size: req.file.size,
        uploaded_by: req.user.id
      });

      // Notify department head and assignee (don't fail upload if notifications fail)
      try {
        const task = await Task.findByPk(req.params.taskId, { include: [{ model: Department }, { model: User, as: 'assignedUser' }] });
        if (task && task.departmentId) {
          const deptHead = await User.findOne({ where: { departmentId: task.departmentId, role: 'department_head' } });
          if (deptHead && deptHead.id !== req.user.id) {
            await notificationService.createNotification({
              userId: deptHead.id,
              type: 'file_uploaded',
              title: 'File Uploaded',
              message: `A new file was uploaded to task: ${task.title}`,
              taskId: task.id
            });
          }
        }
        if (task && task.assignedToId && task.assignedToId !== req.user.id) {
          await notificationService.createNotification({
            userId: task.assignedToId,
            type: 'file_uploaded',
            title: 'File Uploaded',
            message: `A new file was uploaded to task: ${task.title}`,
            taskId: task.id
          });
        }
      } catch (notificationError) {
        console.error('Error creating notifications for file upload:', notificationError);
        // Don't fail the file upload if notifications fail
      }

      res.status(201).json(fileAttachment);
    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).json({ error: 'Error uploading file' });
    }
  }
);

// Upload file for comment
router.post(
  '/comment/:commentId',
  authenticateToken,
  upload.single('file'),
  param('commentId').isString().matches(/^CMT-\d{8}-\d{5}$/),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const fileAttachment = await FileAttachment.create({
        comment_id: req.params.commentId,
        file_name: req.file.originalname,
        file_path: req.file.path,
        file_type: req.file.mimetype,
        file_size: req.file.size,
        uploaded_by: req.user.id
      });

      res.status(201).json(fileAttachment);
    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).json({ error: 'Error uploading file' });
    }
  }
);

// Get file by ID
router.get(
  '/:fileId',
  authenticateToken,
  param('fileId').isString().matches(/^FIL-\d{8}-\d{5}$/),
  async (req, res) => {
    try {
      const fileAttachment = await FileAttachment.findByPk(req.params.fileId, {
        include: [{ model: User, as: 'uploader', attributes: ['id', 'firstname', 'lastname', 'email'] }]
      });

      if (!fileAttachment) {
        return res.status(404).json({ error: 'File not found' });
      }

      res.json(fileAttachment);
    } catch (error) {
      console.error('Error getting file:', error);
      res.status(500).json({ error: 'Error getting file' });
    }
  }
);

// Download file
router.get(
  '/:fileId/download',
  authenticateToken,
  param('fileId').isString().matches(/^FIL-\d{8}-\d{5}$/),
  async (req, res) => {
    try {
      const fileAttachment = await FileAttachment.findByPk(req.params.fileId);

      if (!fileAttachment) {
        return res.status(404).json({ error: 'File not found' });
      }

      if (!fs.existsSync(fileAttachment.file_path)) {
        return res.status(404).json({ error: 'File not found on server' });
      }

      res.download(fileAttachment.file_path, fileAttachment.file_name);
    } catch (error) {
      console.error('Error downloading file:', error);
      res.status(500).json({ error: 'Error downloading file' });
    }
  }
);

// Delete file
router.delete(
  '/:fileId',
  authenticateToken,
  param('fileId').isString().matches(/^FIL-\d{8}-\d{5}$/),
  async (req, res) => {
    try {
      const fileAttachment = await FileAttachment.findByPk(req.params.fileId);

      if (!fileAttachment) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Check if user is authorized to delete
      if (fileAttachment.uploaded_by !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Not authorized to delete this file' });
      }

      // Delete file from filesystem
      if (fs.existsSync(fileAttachment.file_path)) {
        fs.unlinkSync(fileAttachment.file_path);
      }

      // Delete record from database
      await fileAttachment.destroy();

      res.json({ message: 'File deleted successfully' });
    } catch (error) {
      console.error('Error deleting file:', error);
      res.status(500).json({ error: 'Error deleting file' });
    }
  }
);

// List files for ticket
router.get(
  '/ticket/:ticketId',
  authenticateToken,
  param('ticketId').isString().matches(/^TKT-\d{8}-\d{5}$/),
  async (req, res) => {
    try {
      const files = await FileAttachment.findAll({
        where: { ticket_id: req.params.ticketId },
        include: [{ model: User, as: 'uploader', attributes: ['id', 'firstname', 'lastname', 'email'] }]
      });

      res.json(files);
    } catch (error) {
      console.error('Error listing files:', error);
      res.status(500).json({ error: 'Error listing files' });
    }
  }
);

// List files for task
router.get(
  '/task/:taskId',
  authenticateToken,
  param('taskId').isString().matches(/^TSK-\d{8}-\d{5}$/),
  async (req, res) => {
    try {
      const files = await FileAttachment.findAll({
        where: { task_id: req.params.taskId },
        include: [{ model: User, as: 'uploader', attributes: ['id', 'firstname', 'lastname', 'email'] }]
      });

      res.json(files);
    } catch (error) {
      console.error('Error listing files:', error);
      res.status(500).json({ error: 'Error listing files' });
    }
  }
);

// List files for comment
router.get(
  '/comment/:commentId',
  authenticateToken,
  param('commentId').isString().matches(/^CMT-\d{8}-\d{5}$/),
  async (req, res) => {
    try {
      const files = await FileAttachment.findAll({
        where: { comment_id: req.params.commentId },
        include: [{ model: User, as: 'uploader', attributes: ['id', 'firstname', 'lastname', 'email'] }]
      });

      res.json(files);
    } catch (error) {
      console.error('Error listing files:', error);
      res.status(500).json({ error: 'Error listing files' });
    }
  }
);

module.exports = router; 