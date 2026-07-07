import * as path from 'path';
import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IngestionService } from './ingestion.service';

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

@ApiTags('ingestion')
@Controller('ingestion')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post('fetch/json')
  @ApiOperation({ summary: 'Fetch Rick and Morty characters and save as JSON' })
  async fetchJson() {
    const count = await this.ingestionService.fetchAndSaveToFile('json');
    return { count };
  }

  @Post('fetch/xlsx')
  @ApiOperation({ summary: 'Fetch Rick and Morty characters and save as Excel' })
  async fetchExcel() {
    const count = await this.ingestionService.fetchAndSaveToFile('xlsx');
    return { count };
  }

  @Post('import/json')
  @ApiOperation({ summary: 'Parse the local JSON file and batch upsert into MongoDB' })
  async importJson() {
    return this.ingestionService.parseFileAndInsert(
      path.join(process.cwd(), 'data', 'characters.json'),
    );
  }

  @Post('import/xlsx')
  @ApiOperation({ summary: 'Parse the local Excel file and batch upsert into MongoDB' })
  async importXlsx() {
    return this.ingestionService.parseFileAndInsert(
      path.join(process.cwd(), 'data', 'characters.xlsx'),
    );
  }

  @Post('upload')
  @ApiOperation({ summary: 'Upload a JSON/XLSX file and upsert into MongoDB' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    return this.ingestionService.uploadAndInsert(file);
  }
}
