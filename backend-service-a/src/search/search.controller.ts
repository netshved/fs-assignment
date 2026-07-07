import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchQueryDto } from './search.dto';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Search characters with text index and pagination' })
  async search(@Query() query: SearchQueryDto) {
    return this.searchService.search(query.q || '', query.page || 1, query.limit || 20);
  }
}
