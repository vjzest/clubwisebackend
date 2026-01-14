import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { StdPlugin } from 'src/shared/entities/standard-plugin/std-plugin.entity';
import { Model, plugin } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { CreateStdPluginDto } from './dto/create-standard-plugin.dto';
import { generateSlug } from 'src/utils/slug.util';
import { UpdateStdPluginDto } from './dto/update-standard-plugin.dto';
import { UploadService } from 'src/shared/upload/upload.service';
import { StdPluginAsset } from 'src/shared/entities/standard-plugin/std-plugin-asset.entity';
import { generateSafekey, appendRandomSuffix } from './utils/safekey.util';

@Injectable()
export class AdminStdPluginsService {
    constructor(
        @InjectModel(StdPlugin.name)
        private stdPluginModel: Model<StdPlugin>,
        @InjectModel(StdPluginAsset.name)
        private stdPluginAssetModel: Model<StdPluginAsset>,
        private uploadService: UploadService,
    ) { }

    async findAll() {
        try {
            const plugins = await this.stdPluginModel.find()
                .sort({ createdAt: -1 })
                .populate('createdBy', 'firstName lastName email isAdmin');

            const pluginsWithAssetCounts = await Promise.all(
                plugins.map(async (plugin) => {
                    const assetCount = await this.stdPluginAssetModel.countDocuments({ plugin: plugin._id });
                    return {
                        ...plugin.toObject(),
                        totalAssets: assetCount,
                    };
                })
            );

            return pluginsWithAssetCounts;

        } catch (error) {
            console.log('Standard Plugin FIND ALL Error :: ', error);
            throw new InternalServerErrorException('Failed to fetch standard plugins');
        }
    }

    async findOne(id: string) {
        return this.stdPluginModel.findById(id).populate('createdBy', 'firstName lastName email isAdmin');
    }

    async findOneBySlug(slug: string) {
        return this.stdPluginModel.findOne({ slug }).populate('createdBy', 'firstName lastName email isAdmin');
    }

    async create(createStdPluginDto: CreateStdPluginDto, userId: string, logo: Express.Multer.File) {
        try {
            const isNameUnique = await this.stdPluginModel.findOne({ name: createStdPluginDto.name });
            if (isNameUnique) throw new ConflictException('Module Name already exists.');
            if (!logo) throw new BadRequestException('Logo is required');

            const logoUrl = await this.uploadLogo(logo);
            const fields = this.transformFields(createStdPluginDto.fields);
            const safekey = await this.generateUniqueSafekey(createStdPluginDto.name);

            const standardPluginData = {
                name: createStdPluginDto.name,
                slug: generateSlug(createStdPluginDto.name),
                safekey: safekey,
                description: createStdPluginDto.description,
                canBePublic: createStdPluginDto.canBePublic ?? true,
                canBeAdopted: createStdPluginDto.canBeAdopted ?? true,
                createdBy: userId,
                logo: logoUrl,
                fields: fields,
                isActive: true
            };

            const standardPlugin = await this.stdPluginModel.create(standardPluginData);
            return standardPlugin.save();
        } catch (error) {
            console.log('Standard Plugin CREATE Error :: ', error);
            if (error instanceof BadRequestException || error instanceof ConflictException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to create standard plugin');
        }
    }

    async update(
        id: string,
        updateStdPluginDto: UpdateStdPluginDto,
        userId: string,
        logo?: Express.Multer.File
    ) {
        try {

            // const totalAssetsCount = await this.getTotalAssetsCount(id);
            // if (totalAssetsCount > 0) {
            //     throw new BadRequestException('Cannot update standard plugin with assets.');
            // }

            const existingPlugin = await this.stdPluginModel.findById(id);
            if (!existingPlugin) {
                throw new NotFoundException('Standard plugin not found');
            }

            // Check name uniqueness only if name is being updated
            if (updateStdPluginDto.name && updateStdPluginDto.name !== existingPlugin.name) {
                const isNameUnique = await this.stdPluginModel.findOne({
                    name: updateStdPluginDto.name,
                    _id: { $ne: id } // Exclude current document
                });
                if (isNameUnique) {
                    throw new ConflictException('Module Name already exists.');
                }
            }

            // Prepare update data object
            const updateData: any = {
                updatedBy: userId,
                updatedAt: new Date()
            };

            // Only update fields that are provided
            if (updateStdPluginDto.name !== undefined) {
                updateData.name = updateStdPluginDto.name;
                updateData.slug = generateSlug(updateStdPluginDto.name);
            }

            if (updateStdPluginDto.description !== undefined) {
                updateData.description = updateStdPluginDto.description;
            }

            if (updateStdPluginDto.canBePublic !== undefined) {
                updateData.canBePublic = updateStdPluginDto.canBePublic;
            }

            if (updateStdPluginDto.canBeAdopted !== undefined) {
                updateData.canBeAdopted = updateStdPluginDto.canBeAdopted;
            }

            if (updateStdPluginDto.isActive !== undefined) {
                updateData.isActive = updateStdPluginDto.isActive;
            }

            // Handle logo update
            if (logo) {
                const logoUrl = await this.uploadLogo(logo);
                updateData.logo = logoUrl;
            }

            // Handle fields update
            if (updateStdPluginDto.fields !== undefined) {
                const transformedFields = this.transformFields(updateStdPluginDto.fields);
                updateData.fields = transformedFields;
            }

            // Update the plugin
            const updatedPlugin = await this.stdPluginModel.findByIdAndUpdate(
                id,
                { $set: updateData },
                {
                    new: true, // Return updated document
                    runValidators: true // Run mongoose validators
                }
            );

            if (!updatedPlugin) {
                throw new NotFoundException('Standard plugin not found');
            }

            return updatedPlugin;
        } catch (error) {
            console.log('Standard Plugin UPDATE Error :: ', error);
            if (error instanceof BadRequestException ||
                error instanceof ConflictException ||
                error instanceof NotFoundException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to update standard plugin');
        }
    }

    async publishPlugin(id: string) {
        try {
            const plugin = await this.stdPluginModel.findById(id);
            if (!plugin) throw new NotFoundException('Standard plugin not found');

            plugin.status = 'published';
            return plugin.save();
        } catch (error) {
            console.log('Standard Plugin PUBLISH Error :: ', error);
            if (error instanceof NotFoundException) throw error;

            throw new InternalServerErrorException('Failed to publish standard plugin');
        }
    }

    async deletePlugin(id: string) {
        try {
            const plugin = await this.stdPluginModel.findById(id);
            if (!plugin) {
                throw new NotFoundException('Standard plugin not found');
            }

            // Check if plugin has any assets
            const assetCount = await this.getTotalAssetsCount(id);
            if (assetCount > 0) {
                throw new BadRequestException('Cannot delete plugin with existing assets. Please delete all assets first.');
            }

            await this.stdPluginModel.findByIdAndDelete(id);
            return { message: 'Plugin deleted successfully' };
        } catch (error) {
            console.log('Standard Plugin DELETE Error :: ', error);
            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to delete standard plugin');
        }
    }


    private async uploadLogo(logo: Express.Multer.File) {
        const logoUpload = this.uploadService.uploadFile(
            logo.buffer,
            logo.originalname,
            logo.mimetype,
            'std-plugin',
        );
        const logoResult = await logoUpload;
        return logoResult.url;
    }

    private transformFields(fields: any[]) {
        return fields.map((field: any) => ({
            key: field.key,
            label: field.label,
            type: field.type,
            required: field.required ?? false,
            placeholder: field.placeholder,
            minLength: field.minLength,
            maxLength: field.maxLength,
            min: field?.type === 'number' ? field.min : undefined,
            max: field?.type === 'number' ? field.max : undefined,
            minDate: field?.type === 'date' ? field.minDate ? new Date(field.minDate) : undefined : undefined,
            maxDate: field?.type === 'date' ? field.maxDate ? new Date(field.maxDate) : undefined : undefined,
            disablePast: field?.type === 'date' ? field.disablePast ? true : false : undefined,
            minAllowed: field.minAllowed || undefined,
            maxAllowed: field.maxAllowed || undefined,
            options: field?.type === 'select' ? field.options ?? [] : undefined
        }));
    }

    private async getTotalAssetsCount(pluginId: string) {
        return await this.stdPluginAssetModel.countDocuments({ plugin: pluginId });
    }

    /**
     * Generates a unique safekey for a module
     * If the generated safekey already exists, appends a random 3-digit number and retries
     * @param name - The module name to generate safekey from
     * @returns A unique safekey
     */
    private async generateUniqueSafekey(name: string): Promise<string> {
        let safekey = generateSafekey(name);
        let isUnique = false;
        let attempts = 0;
        const maxAttempts = 10; // Prevent infinite loop

        while (!isUnique && attempts < maxAttempts) {
            const existing = await this.stdPluginModel.findOne({ safekey });

            if (!existing) {
                isUnique = true;
            } else {
                // Append random 3-digit suffix and try again
                safekey = appendRandomSuffix(generateSafekey(name));
                attempts++;
            }
        }

        if (!isUnique) {
            throw new InternalServerErrorException('Failed to generate unique safekey after multiple attempts');
        }

        return safekey;
    }
}
