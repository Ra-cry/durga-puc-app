import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPucRecord extends Document {
  vehicleNo: string;
  vehicleClass: string;
  bsStage: 'BS1' | 'BS2' | 'BS3' | 'BS4' | 'BS6';
  fuelType: string;
  customerName: string;
  customerPhone: string;
  agent: string | null;
  issuedAt: Date;
  validTill: Date;
  status: 'active' | 'expired';
  source: 'manual' | 'excel_import';
  createdAt: Date;
  updatedAt: Date;
}

const PucRecordSchema = new Schema<IPucRecord>(
  {
    vehicleNo: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      match: [/^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{3,5}$/, 'Invalid vehicle number format'],
    },
    vehicleClass: {
      type: String,
      required: false,
      default: 'CAR',
      trim: true,
      uppercase: true,
    },
    bsStage: {
      type: String,
      required: true,
      enum: ['BS1', 'BS2', 'BS3', 'BS4', 'BS6'],
    },
    fuelType: {
      type: String,
      required: true,
      trim: true,
    },
    customerName: {
      type: String,
      required: false,
      default: '—',
      trim: true,
    },
    customerPhone: {
      type: String,
      required: true,
      trim: true,
      match: [/^\d{10}$/, 'Phone number must be 10 digits'],
    },
    agent: {
      type: String,
      default: null,
      trim: true,
    },
    issuedAt: {
      type: Date,
      required: true,
    },
    validTill: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'expired'],
      default: 'active',
    },
    source: {
      type: String,
      enum: ['manual', 'excel_import'],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast querying
PucRecordSchema.index({ vehicleNo: 1 });
PucRecordSchema.index({ vehicleClass: 1 });
PucRecordSchema.index({ validTill: 1 });
PucRecordSchema.index({ issuedAt: 1 });
PucRecordSchema.index({ issuedAt: 1, validTill: 1 });
PucRecordSchema.index({ customerPhone: 1 });

const PucRecord: Model<IPucRecord> =
  mongoose.models.PucRecord || mongoose.model<IPucRecord>('PucRecord', PucRecordSchema);

export default PucRecord;
