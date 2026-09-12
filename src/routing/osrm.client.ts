import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface OsrmCoordinate {
  latitude: number;
  longitude: number;
}

export interface OsrmRouteGeometry {
  type: 'LineString';
  coordinates: number[][];
}

export interface OsrmRoute {
  distance: number;
  duration: number;
  geometry?: OsrmRouteGeometry;
}

interface OsrmRouteResponse {
  code: string;
  routes?: OsrmRoute[];
  message?: string;
}

@Injectable()
export class OsrmClient {
  private readonly logger = new Logger(
    OsrmClient.name,
  );

  private readonly baseUrl: string;

  constructor(
    private readonly configService: ConfigService,
  ) {
    this.baseUrl =
      this.configService.getOrThrow<string>(
        'OSRM_BASE_URL',
      );
  }

  async getRoute(
    from: OsrmCoordinate,
    to: OsrmCoordinate,
    options?: {
      overview?: 'full' | 'simplified' | 'false';
      geometries?: 'geojson' | 'polyline' | 'polyline6';
      steps?: boolean;
    },
  ): Promise<OsrmRoute> {
    const coordinates = [
      `${from.longitude},${from.latitude}`,
      `${to.longitude},${to.latitude}`,
    ].join(';');

    const params = new URLSearchParams({
      overview: options?.overview ?? 'full',
      geometries:
        options?.geometries ?? 'geojson',
      steps: String(
        options?.steps ?? false,
      ),
    });

    const url =
      `${this.baseUrl}/route/v1/driving/` +
      `${coordinates}?${params.toString()}`;

    this.logger.debug(
      `OSRM ROUTE REQUEST | ${url}`,
    );

    const response = await fetch(url);

    if (!response.ok) {
      throw new InternalServerErrorException(
        `OSRM request failed with status ${response.status}`,
      );
    }

    const data =
      (await response.json()) as OsrmRouteResponse;

    if (
      data.code !== 'Ok' ||
      !data.routes ||
      data.routes.length === 0
    ) {
      throw new InternalServerErrorException(
        data.message ??
          'OSRM could not calculate route',
      );
    }

    return data.routes[0];
  }
}
