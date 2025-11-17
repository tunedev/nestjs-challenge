import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { HttpService } from '@nestjs/axios';
import { Model } from 'mongoose';
import { of, throwError } from 'rxjs';
import { AxiosError, AxiosResponse } from 'axios';

import { MusicBrainzService } from './musicbrainz.service';
import {
  MusicBrainzRecord,
  MusicBrainzRecordDocument,
} from '../schemas/musicbrainz-record.schema';

const mbid = '561b17b2-a511-4ab6-8ac8-d3eae81f4544';

const mockXmlData = `<?xml version="1.0" encoding="UTF-8"?>
<metadata xmlns="http://musicbrainz.org/ns/mmd-2.0#"><release id="561b17b2-a511-4ab6-8ac8-d3eae81f4544"><title>The Parachute Candidate</title><quality>normal</quality><date>2016</date><country>US</country><release-event-list count="1"><release-event><date>2016</date><area id="489ce91b-6658-3307-9877-795b68554c98"><name>United States</name><sort-name>United States</sort-name><iso-3166-1-code-list><iso-3166-1-code>US</iso-3166-1-code></iso-3166-1-code-list></area></release-event></release-event-list><cover-art-archive><artwork>false</artwork><count>0</count><front>false</front><back>false</back></cover-art-archive><medium-list count="1"><medium id="ae24eb44-4229-4c14-a2cd-9f96d1f999e2"><position>1</position><format id="f5e6e254-8f39-331c-936b-9c69d686dc47">Cassette</format><track-list count="4" offset="0"><track id="faf731b7-bd4a-4b77-bffb-2ca1aa8cc713"><position>1</position><number>A1</number><recording id="b7f9e1ac-f952-4b07-92bd-7f02d8683d35"><title>Delta Pisces</title><first-release-date>2016</first-release-date></recording></track><track id="bc5a09a2-01c8-407d-bf43-33899c803d0f"><position>2</position><number>A2</number><recording id="c2e8f350-7ab0-4573-8b5c-013c629b7314"><title>The Parachute Candidate</title><first-release-date>2016</first-release-date></recording></track><track id="44d1ff92-a48e-4064-af95-9b6a36c6ca27"><position>3</position><number>B1</number><recording id="1c0c8b03-12f3-4fdb-ac84-e62382191673"><title>Knoxville Bubblegum</title><first-release-date>2016</first-release-date></recording></track><track id="e1d40fc3-d936-476e-84ae-474e2158f3e7"><position>4</position><number>B2</number><recording id="55691f19-1ada-45e6-b71e-f4042734564b"><title>Omega</title><first-release-date>2016</first-release-date></recording></track></track-list></medium></medium-list></release></metadata>
`;

const mockExistingRecord: MusicBrainzRecordDocument = {
  _id: mbid,
  tracklist: [
    { position: 1, title: 'Delta Pisces' },
    { position: 2, title: 'The Parachute Candidate' },
    { position: 3, title: 'Knoxville Bubblegum' },
    { position: 4, title: 'Omega' },
  ],
} as MusicBrainzRecordDocument;

describe('MusicBrainzService', () => {
  let service: MusicBrainzService;
  let httpService: HttpService;
  let model: Model<MusicBrainzRecordDocument>;

  const mockSave = jest.fn().mockResolvedValue(mockExistingRecord);
  const mockModelInstance = { save: mockSave };

  const mockMusicBrainzRecordModel = {
    findById: jest.fn(),
    new: jest.fn().mockImplementation(() => mockModelInstance),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MusicBrainzService,
        {
          provide: getModelToken(MusicBrainzRecord.name),
          useValue: jest.fn().mockImplementation(() => mockModelInstance),
        },
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MusicBrainzService>(MusicBrainzService);
    httpService = module.get<HttpService>(HttpService);
    // To test static methods like `findById`, we need to get the mock constructor itself
    const modelConstructor = module.get<jest.Mock>(
      getModelToken(MusicBrainzRecord.name),
    );
    // Assign the static method mock to the constructor
    (modelConstructor as any).findById = mockMusicBrainzRecordModel.findById;
    // Re-assign to model for simplicity in tests
    model = modelConstructor as any;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOrCreateFromMBID', () => {
    it('should return an existing record if it is found in the database', async () => {
      (model.findById as jest.Mock).mockResolvedValue(mockExistingRecord);

      const result = await service.findOrCreateFromMBID(mbid);

      expect(result).toEqual(mockExistingRecord);
      expect(model.findById).toHaveBeenCalledWith(mbid);
      expect(httpService.get).not.toHaveBeenCalled();
    });

    it('should fetch, parse, save, and return a new record if one does not exist', async () => {
      (model.findById as jest.Mock).mockResolvedValue(null);

      const mockHttpResponse: AxiosResponse = {
        data: mockXmlData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} as any },
      };
      (httpService.get as jest.Mock).mockReturnValue(of(mockHttpResponse));

      const result = await service.findOrCreateFromMBID(mbid);

      expect(model.findById).toHaveBeenCalledWith(mbid);
      expect(httpService.get).toHaveBeenCalledWith(
        expect.stringContaining(mbid),
        expect.any(Object),
      );
      expect(model).toHaveBeenCalledWith(
        {
          _id: mbid,
          tracklist: [
            { position: 1, title: 'Delta Pisces' },
            { position: 2, title: 'The Parachute Candidate' },
            { position: 3, title: 'Knoxville Bubblegum' },
            { position: 4, title: 'Omega' },
          ],
        },
        false,
      );
      expect(mockSave).toHaveBeenCalled();
      expect(result).toEqual(mockExistingRecord);
    });

    it('should return null if the MusicBrainz API call fails', async () => {
      (model.findById as jest.Mock).mockResolvedValue(null);
      const apiError = new AxiosError('API is down');
      (httpService.get as jest.Mock).mockReturnValue(
        throwError(() => apiError),
      );

      const result = await service.findOrCreateFromMBID(mbid);

      expect(result).toBeNull();
      expect(model.findById).toHaveBeenCalledWith(mbid);
      expect(httpService.get).toHaveBeenCalled();
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should return null if the XML parsing fails', async () => {
      (model.findById as jest.Mock).mockResolvedValue(null);
      const mockHttpResponse: AxiosResponse = {
        data: '{ definitely-not-xml }',
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/xml' },
        config: { headers: {} as any },
      };
      (httpService.get as jest.Mock).mockReturnValue(of(mockHttpResponse));

      const result = await service.findOrCreateFromMBID(mbid);

      expect(result).toBeNull();
      expect(httpService.get).toHaveBeenCalled();
      expect(mockSave).not.toHaveBeenCalled();
    });
  });
});
