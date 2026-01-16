const express = require('express');
const router = express.Router();
const Comment = require('../models/comment');

router.post('/', async (req, res) => {
  const comment = await Comment.create(req.body);
  res.json(comment);
});

router.get('/:documentId', async (req, res) => {
  const comments = await Comment.find({ documentId: req.params.documentId });
  res.json(comments);
});

// Upvote comment
router.post('/:id/upvote', async (req, res) => {
  try {
    const { userId } = req.body;
    const comment = await Comment.findById(req.params.id);

    const existingVote = comment.voters.find(v => v.userId === userId);

    if (existingVote) {
      if (existingVote.vote === 'upvote') {
        // Remove upvote
        comment.upvotes -= 1;
        comment.voters = comment.voters.filter(v => v.userId !== userId);
      } else {
        // Change downvote to upvote
        comment.downvotes -= 1;
        comment.upvotes += 1;
        existingVote.vote = 'upvote';
      }
    } else {
      // Add upvote
      comment.upvotes += 1;
      comment.voters.push({ userId, vote: 'upvote' });
    }

    await comment.save();
    res.json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Downvote comment
router.post('/:id/downvote', async (req, res) => {
  try {
    const { userId } = req.body;
    const comment = await Comment.findById(req.params.id);

    const existingVote = comment.voters.find(v => v.userId === userId);

    if (existingVote) {
      if (existingVote.vote === 'downvote') {
        // Remove downvote
        comment.downvotes -= 1;
        comment.voters = comment.voters.filter(v => v.userId !== userId);
      } else {
        // Change upvote to downvote
        comment.upvotes -= 1;
        comment.downvotes += 1;
        existingVote.vote = 'downvote';
      }
    } else {
      // Add downvote
      comment.downvotes += 1;
      comment.voters.push({ userId, vote: 'downvote' });
    }

    await comment.save();
    res.json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Edit comment
router.put('/:id', async (req, res) => {
  try {
    const { text, userId } = req.body;
    const comment = await Comment.findById(req.params.id);

    // Check if user is the comment author
    if (comment.user !== userId) {
      return res.status(403).json({ error: 'Only comment author can edit' });
    }

    comment.text = text;
    await comment.save();
    res.json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete comment
router.delete('/:id', async (req, res) => {
  try {
    const { userId } = req.body;
    const comment = await Comment.findById(req.params.id);

    // Check if user is the comment author
    if (comment.user !== userId) {
      return res.status(403).json({ error: 'Only comment author can delete' });
    }

    await Comment.findByIdAndDelete(req.params.id);
    res.json({ message: 'Comment deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;