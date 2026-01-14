import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaymentSlabs } from 'src/shared/entities/payment-slabs.entity';
import { UpdatePaymentSlabsDto, SlabDto } from './dto/update-payment-slabs.dto';
import {
  FEATURE_DEFINITIONS,
  FEATURE_KEYS,
  FeatureInputType,
} from './constants/feature-definitions.constant';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(PaymentSlabs.name)
    private readonly paymentSlabsModel: Model<PaymentSlabs>,
  ) {}

  async getPaymentSlabs() {
    try {
      let config = await this.paymentSlabsModel.findOne({});

      if (!config) {
        config = await this.initializeDefaultSlabs();
      }

      return { data: config, featureDefinitions: FEATURE_DEFINITIONS };
    } catch (error) {
      console.error('Get Payment Slabs Error:', error);
      throw new InternalServerErrorException('Failed to fetch payment slabs');
    }
  }

  async updatePaymentSlabs(updateDto: UpdatePaymentSlabsDto) {
    // Validate slab1 is always free
    const slab1 = updateDto.slabs.find((s) => s.slabKey === 'slab1');
    if (slab1 && (slab1.price !== 0 || !slab1.isFree)) {
      throw new BadRequestException('Slab 1 must always be free with price 0');
    }

    // Validate cascade rules before saving
    this.validateCascadeRules(updateDto.slabs);

    try {
      const updated = await this.paymentSlabsModel.findOneAndUpdate(
        {},
        { $set: { slabs: updateDto.slabs } },
        { new: true, upsert: true, runValidators: true },
      );
      return { data: updated, message: 'Payment slabs updated successfully' };
    } catch (error) {
      console.error('Update Payment Slabs Error:', error);
      throw new InternalServerErrorException('Failed to update payment slabs');
    }
  }

  async getFeatureDefinitions() {
    return FEATURE_DEFINITIONS;
  }

  private validateCascadeRules(slabs: SlabDto[]) {
    // Sort slabs by order (slab1=1, slab2=2, etc.)
    const sortedSlabs = [...slabs].sort((a, b) => a.order - b.order);

    for (let i = 0; i < sortedSlabs.length - 1; i++) {
      const lowerSlab = sortedSlabs[i]; // e.g., slab1
      const higherSlab = sortedSlabs[i + 1]; // e.g., slab2

      for (const lowerFeature of lowerSlab.features) {
        const higherFeature = higherSlab.features.find(
          (f) => f.featureKey === lowerFeature.featureKey,
        );

        if (!higherFeature) continue;

        const featureDef = FEATURE_DEFINITIONS[lowerFeature.featureKey];
        if (!featureDef) continue;

        if (featureDef.inputType === FeatureInputType.COUNT_RANGE) {
          // Count Range: higher slab value must be >= lower slab value
          if (higherFeature.countValue < lowerFeature.countValue) {
            throw new BadRequestException(
              `${featureDef.label}: ${higherSlab.name} (${higherFeature.countValue}) must be >= ${lowerSlab.name} (${lowerFeature.countValue})`,
            );
          }
        } else if (featureDef.inputType === FeatureInputType.YES_NO) {
          // Yes/No: If lower slab has "Yes", higher must also have "Yes"
          if (lowerFeature.enabled && !higherFeature.enabled) {
            throw new BadRequestException(
              `${featureDef.label}: If enabled in ${lowerSlab.name}, must also be enabled in ${higherSlab.name}`,
            );
          }
        }
      }
    }
  }

  private async initializeDefaultSlabs() {
    const defaultSlabs = [
      {
        slabKey: 'slab1',
        name: 'Free',
        price: 0,
        isFree: true,
        order: 1,
        features: [],
        description: '',
        annualPrice: 0,
        isPopular: false,
        buttonText: 'Get started',
        displayFeatures: [],
      },
      {
        slabKey: 'slab2',
        name: 'Basic',
        price: 0,
        isFree: false,
        order: 2,
        features: [],
        description: '',
        annualPrice: 0,
        isPopular: false,
        buttonText: 'Get started',
        displayFeatures: [],
      },
      {
        slabKey: 'slab3',
        name: 'Pro',
        price: 0,
        isFree: false,
        order: 3,
        features: [],
        description: '',
        annualPrice: 0,
        isPopular: true,
        buttonText: 'Get started',
        displayFeatures: [],
      },
      {
        slabKey: 'slab4',
        name: 'Max',
        price: 0,
        isFree: false,
        order: 4,
        features: [],
        description: '',
        annualPrice: 0,
        isPopular: false,
        buttonText: 'Get started',
        displayFeatures: [],
      },
    ];

    // Initialize features for each slab
    defaultSlabs.forEach((slab) => {
      slab.features = FEATURE_KEYS.map((key) => ({
        featureKey: key,
        countValue: 0,
        enabled: false,
      }));
    });

    const config = new this.paymentSlabsModel({
      slabs: defaultSlabs,
    });

    return config.save();
  }
}
