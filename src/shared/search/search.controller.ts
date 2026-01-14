import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';

@ApiTags('Search')
@ApiBearerAuth()
@Controller('search')
export class SearchController {
    constructor(private readonly searchService: SearchService) { }

    @Get()
    async search(@Query('term') term: string, @Query('tag') tag?: string, @Param('id') id?: string) {
        return await this.searchService.search(term, tag);
    }

    @Get('category-assets')
    async searchAssetsByCategory(
        @Query('term') term: string,
        @Query('category') category: string
    ) {
        return await this.searchService.searchAssetsByForumNameAndCategory(term, category);
    }
}
