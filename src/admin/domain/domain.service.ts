// src/domains/domains.service.ts
import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
    InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateDomainDto } from './dto/create-domain.dto';
import { UpdateDomainDto } from './dto/update-domain.dto';
import { Domain } from 'src/shared/entities/domain.entity';

@Injectable()
export class DomainService {
    constructor(
        @InjectModel(Domain.name) private readonly domainModel: Model<Domain>,
    ) { }

    private validateUniqueItemValues(items: { value: string }[]) {
        const values = items.map((i) => i.value);
        const set = new Set(values);
        if (set.size !== values.length) {
            throw new BadRequestException('Duplicate item values are not allowed');
        }
    }

    async create(createDto: CreateDomainDto) {
        if (createDto.items) this.validateUniqueItemValues(createDto.items);

        try {
            const created = new this.domainModel(createDto);
            return await created.save();
        } catch (err: any) {
            // duplicate key (unique label)
            if (err.code === 11000) {
                throw new ConflictException('A domain with this label already exists');
            }
            throw err;
        }
    }

    async update(id: string, updateDto: UpdateDomainDto) {
        if (updateDto.items) this.validateUniqueItemValues(updateDto.items);

        const updated = await this.domainModel.findByIdAndUpdate(
            id,
            { $set: updateDto },
            { new: true, runValidators: true },
        );

        if (!updated) throw new NotFoundException('Domain not found');
        return updated;
    }

    async toggleStatus(id: string) {
        const domain = await this.domainModel.findById(id);
        if (!domain) throw new NotFoundException('Domain not found');

        domain.status = domain.status === 'active' ? 'inactive' : 'active';
        await domain.save();
        return domain;
    }

    async findAll() {
        try {
            // Fetch all domains, sorted by most recent first
            const domains = await this.domainModel
                .find()
                .sort({ createdAt: -1 })

            // Compute derived info: totalItems
            const domainsWithCounts = domains.map((domain) => ({
                ...domain.toObject(),
                totalItems: domain.items?.length || 0,
            }));

            return domainsWithCounts;
        } catch (error) {
            console.error('Domain FIND ALL Error ::', error);
            throw new InternalServerErrorException('Failed to fetch domains');
        }
    }

    // helper to fetch by id (used in tests/demo)
    async findById(id: string) {
        return this.domainModel.findById(id);
    }
}  