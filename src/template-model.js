import mongoose from 'mongoose';

const TemplateSchema = new mongoose.Schema({
  name: String,
  message: String
});

export default mongoose.model('Template', TemplateSchema);