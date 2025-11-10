import 'dotenv/config';
import mongoose from 'mongoose';
require('dotenv').config();
export const connect = async ()=>{
    try {
        await mongoose.connect(process.env.MONGO_URL);
        console.log("connect successs");
    } catch (error) {
        console.log("connect error");
    }
}