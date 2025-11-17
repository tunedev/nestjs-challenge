import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import { parseStringPromise } from 'xml2js';
import type { AxiosResponse } from 'axios';

import {
  MusicBrainzReleaseResponse,
  MbMedium,
} from '../interfaces/musicbrainz.interfaces';
import {
  MusicBrainzRecord,
  MusicBrainzRecordDocument,
} from '../schemas/musicbrainz-record.schema';

type TrackSummary = { position: number; title: string };

@Injectable()
export class MusicBrainzService {
  private readonly logger = new Logger(MusicBrainzService.name);
  private readonly MUSICBRAINZ_API_URL = 'https://musicbrainz.org/ws/2/release';

  constructor(
    @InjectModel(MusicBrainzRecord.name)
    private readonly musicBrainzRecordModel: Model<MusicBrainzRecordDocument>,
    private readonly httpService: HttpService,
  ) {}

  async findOrCreateFromMBID(
    mbid: string,
  ): Promise<MusicBrainzRecordDocument | null> {
    const existingRecord = await this.musicBrainzRecordModel.findById(mbid);
    if (existingRecord) {
      this.logger.log(`Found cached MusicBrainz record for MBID: ${mbid}`);
      return existingRecord;
    }

    const url = `${this.MUSICBRAINZ_API_URL}/${mbid}?inc=media+recordings`;
    this.logger.log(
      `Fetching record from MusicBrainz for MBID: ${mbid}: Full URL: ${url}`,
    );

    try {
      const response = await firstValueFrom(
        this.httpService.get<string>(url, {
          headers: {
            'User-Agent': 'RecordStoreApp/1.0.0 ( myapp@example.com )',
          },
          responseType: 'text',
        }),
      );

      const tracklist = await this.buildTracklistFromResponse(response, mbid);
      if (!tracklist) {
        return null;
      }

      const recordData: Omit<MusicBrainzRecord, 'created' | 'lastModified'> & {
        _id: string;
      } = {
        _id: mbid,
        tracklist,
      };

      const newRecord = new this.musicBrainzRecordModel(recordData, false);
      const savedRecord = await newRecord.save();
      this.logger.log(`Saved new MusicBrainz record for MBID: ${mbid}`);
      return savedRecord;
    } catch (error) {
      this.logger.error(
        `Failed to fetch or parse data for MBID: ${mbid}`,
        (error as Error).stack,
      );
      return null;
    }
  }

  private async buildTracklistFromResponse(
    response: AxiosResponse<string>,
    mbid: string,
  ): Promise<TrackSummary[] | null> {
    const raw = response.data;
    const contentType = (response.headers['content-type'] || '').toLowerCase();

    this.logger.verbose(
      `MusicBrainz raw payload for MBID ${mbid} (first 120 chars): ${String(raw)
        .slice(0, 120)
        .replace(/\s+/g, ' ')}`,
    );

    if (typeof raw !== 'string') {
      this.logger.error(
        `Expected string response from MusicBrainz for MBID: ${mbid}, got ${typeof raw}. ` +
          `Status: ${response.status}, Content-Type: ${contentType}`,
      );
      return null;
    }

    const trimmed = raw.trim();

    try {
      if (
        contentType.includes('application/json') ||
        contentType.includes('json')
      ) {
        return this.extractTracklistFromJson(trimmed, mbid);
      }

      if (
        contentType.includes('application/xml') ||
        contentType.includes('text/xml') ||
        contentType.includes('application/xhtml+xml')
      ) {
        return this.extractTracklistFromXml(trimmed, mbid);
      }

      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        return this.extractTracklistFromJson(trimmed, mbid);
      }

      if (trimmed.startsWith('<')) {
        return this.extractTracklistFromXml(trimmed, mbid);
      }

      this.logUnexpectedFormat(mbid, response, raw);
      return null;
    } catch (err) {
      this.logger.error(
        `Failed to parse MusicBrainz response for MBID: ${mbid}`,
        (err as Error).stack,
      );
      return null;
    }
  }

  private extractTracklistFromJson(
    rawJson: string,
    mbid: string,
  ): TrackSummary[] {
    this.logger.verbose(`Parsing MusicBrainz JSON response for MBID ${mbid}`);

    const json = JSON.parse(rawJson) as any;
    const media = Array.isArray(json.media) ? json.media : [];

    const allTracks = media.flatMap((m) => m.tracks ?? []);

    return allTracks.map((track: any) => ({
      position: Number.parseInt(
        track.position ?? track['track-number'] ?? '0',
        10,
      ),
      title: track.recording?.title ?? track.title,
    }));
  }

  private async extractTracklistFromXml(
    rawXml: string,
    mbid: string,
  ): Promise<TrackSummary[]> {
    this.logger.verbose(`Parsing MusicBrainz XML response for MBID ${mbid}`);

    const parsedData: MusicBrainzReleaseResponse = await parseStringPromise(
      rawXml,
      {
        explicitArray: false,
        attrkey: 'attr',
      },
    );

    const release = parsedData.metadata.release;
    const mediumList = release['medium-list'];
    const mediums: MbMedium[] = Array.isArray(mediumList.medium)
      ? mediumList.medium
      : [mediumList.medium];

    const allTracks = mediums.flatMap((medium) => medium['track-list'].track);

    return allTracks.map((track) => ({
      position: Number.parseInt(track.position, 10),
      title: track.recording.title,
    }));
  }

  private logUnexpectedFormat(
    mbid: string,
    response: AxiosResponse<string>,
    raw: unknown,
  ) {
    const contentType = (response.headers['content-type'] || '').toLowerCase();

    this.logger.error(
      `Unexpected response format from MusicBrainz for MBID: ${mbid}. ` +
        `Status: ${response.status}, Content-Type: ${contentType}`,
    );
    this.logger.verbose(
      `Raw response (first 300 chars): ${JSON.stringify(raw).slice(0, 300)}`,
    );
  }
}
