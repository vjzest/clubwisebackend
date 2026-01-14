import { Injectable } from '@nestjs/common';
import { CreateConfigurationDto } from './dto/create-configuration.dto';
import { Configuration } from 'src/shared/entities/configuration.entity';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class ConfigurationService {
    constructor(@InjectModel(Configuration.name) private readonly configurationModel: Model<Configuration>) { }

    async updateAssetCount(createConfigurationDto: CreateConfigurationDto) {
        try {
            const configuration = await this.configurationModel.findOne({});
            if (!configuration) {
                const created = new this.configurationModel(createConfigurationDto);
                return await created.save();
            }
            configuration.assetCreationCount = createConfigurationDto.assetCreationCount;
            return await configuration.save();
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    async getConfiguration() {
        try {
            let configuration = await this.configurationModel.findOne({});
            if (!configuration) configuration = new this.configurationModel();
            return configuration;
        } catch (error) {
            console.log(error);
            throw error;
        }
    }
}
