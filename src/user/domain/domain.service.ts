import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Domain } from 'src/shared/entities/domain.entity';

@Injectable()
export class DomainService {
    constructor(
        @InjectModel(Domain.name) private readonly domainModel: Model<Domain>,
    ) { }

    async findAll() {
        try {
            return this.domainModel.find().select("label items").exec();
        } catch (error) {
            console.log(error);
            throw error;
        }
    }
}
