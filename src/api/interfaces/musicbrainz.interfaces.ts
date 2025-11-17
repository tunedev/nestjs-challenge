export interface MusicBrainzReleaseResponse {
  metadata: {
    release: MbRelease;
    _xmlns: string;
  };
}

export interface MbRelease {
  title: string;
  quality: string;
  date: string;
  country: string;
  'release-event-list': MbReleaseEventList;
  'cover-art-archive': MbCoverArtArchive;
  'medium-list': MbMediumList;
  _id: string;
}

export interface MbReleaseEventList {
  'release-event': MbReleaseEvent | MbReleaseEvent[];
  _count: string;
}

export interface MbReleaseEvent {
  date: string;
  area: MbArea;
}

export interface MbArea {
  name: string;
  'sort-name': string;
  'iso-3166-1-code-list': {
    'iso-3166-1-code': string | string[];
  };
  _id: string;
}

export interface MbCoverArtArchive {
  artwork: string;
  count: string;
  front: string;
  back: string;
}

export interface MbMediumList {
  medium: MbMedium | MbMedium[];
  _count: string;
}

export interface MbMedium {
  position: string;
  format: {
    _id: string;
    __text: string;
  };
  'track-list': MbTrackList;
  _id: string;
}

export interface MbTrackList {
  track: MbTrack[];
  _count: string;
  _offset: string;
}

export interface MbTrack {
  position: string;
  number: string;
  recording: MbRecording;
  _id: string;
}

export interface MbRecording {
  title: string;
  'first-release-date': string;
  _id: string;
}
