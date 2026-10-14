import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
    console.log('successful!');
    res.status(200).json({ message: 'successful' });
});

export default router;