import {
  BadRequestException,
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

export interface OsrmRouteStep {
  distance: number;
  duration: number;
  name: string;
  mode: string;
  maneuver: {
    bearing_before?: number;
    bearing_after?: number;
    location: number[];
    type: string;
    modifier?: string;
  };
}

export interface OsrmRouteLeg {
  distance: number;
  duration: number;
  steps?: OsrmRouteStep[];
}

export interface OsrmRoute {
  distance: number;
  duration: number;
  geometry?: OsrmRouteGeometry;
  legs?: OsrmRouteLeg[];
}

interface OsrmRouteResponse {
  code: string;
  routes?: OsrmRoute[];
  message?: string;
}

export interface OsrmRouteOptions {
  overview?: 'full' | 'simplified' | 'false';
  geometries?: 'geojson' | 'polyline' | 'polyline6';
  steps?: boolean;
  alternatives?: boolean;
}

@Injectable()
export class OsrmClient {
  private readonly logger = new Logger(
    OsrmClient.name,
  );

  private readonly baseUrl: string;
  private readonly timeoutMs = 10_000;

  constructor(
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService
      .getOrThrow<string>('OSRM_BASE_URL')
      .replace(/\/+$/, '');
  }

  async getRoute(
    from: OsrmCoordinate,
    to: OsrmCoordinate,
    options: OsrmRouteOptions = {},
  ): Promise<OsrmRoute> {
    return this.getRouteThroughPoints(
      [from, to],
      options,
    );
  }

  async getRouteThroughPoints(
    points: OsrmCoordinate[],
    options: OsrmRouteOptions = {},
  ): Promise<OsrmRoute> {
    if (points.length < 2) {
      throw new BadRequestException(
        'At least two coordinates are required to calculate a route',
      );
    }

    this.validateCoordinates(points);

    const coordinates =
      this.formatCoordinates(points);

    const params =
      this.buildQueryParams(options);

    const url =
      `${this.baseUrl}/route/v1/driving/` +
      `${coordinates}?${params.toString()}`;

    this.logger.debug(
      `OSRM ROUTE REQUEST | ${url}`,
    );

    const response =
      await this.fetchRoute(url);

    const data =
      await this.parseResponse(response);

    if (
      data.code !== 'Ok' ||
      !data.routes ||
      data.routes.length === 0
    ) {
      this.logger.warn(
        `OSRM could not calculate route | ` +
        `code=${data.code} | ` +
        `message=${data.message ?? 'unknown'}`,
      );

      throw new InternalServerErrorException(
        data.message ??
          'OSRM could not calculate route',
      );
    }

    const route = data.routes[0];

    if (!route.geometry) {
      this.logger.warn(
        'OSRM returned a route without geometry',
      );
    }

    return route;
  }

  private formatCoordinates(
    points: OsrmCoordinate[],
  ): string {
    return points
      .map(
        ({
          latitude,
          longitude,
        }) =>
          `${longitude},${latitude}`,
      )
      .join(';');
  }

  private buildQueryParams(
    options: OsrmRouteOptions,
  ): URLSearchParams {
    return new URLSearchParams({
      overview:
        options.overview ?? 'full',

      geometries:
        options.geometries ?? 'geojson',

      steps: String(
        options.steps ?? true,
      ),

      alternatives: String(
        options.alternatives ?? false,
      ),
    });
  }

  private async fetchRoute(
    url: string,
  ): Promise<Response> {
    const controller =
      new AbortController();

    const timeout = setTimeout(
      () =>
        controller.abort(),
      this.timeoutMs,
    );

    try {
      return await fetch(url, {
        signal: controller.signal,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === 'AbortError'
      ) {
        this.logger.error(
          `OSRM request timed out after ${this.timeoutMs}ms`,
        );

        throw new InternalServerErrorException(
          'OSRM request timed out',
        );
      }

      this.logger.error(
        'Could not connect to OSRM',
        error instanceof Error
          ? error.stack
          : String(error),
      );

      throw new InternalServerErrorException(
        'Could not connect to OSRM',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async parseResponse(
    response: Response,
  ): Promise<OsrmRouteResponse> {
    if (!response.ok) {
      const errorBody =
        await this.getErrorBody(
          response,
        );

      this.logger.error(
        `OSRM request failed | ` +
          `status=${response.status} | ` +
          `${errorBody}`,
      );

      throw new InternalServerErrorException(
        `OSRM request failed with status ${response.status}`,
      );
    }

    try {
      return (await response.json()) as
        OsrmRouteResponse;
    } catch (error) {
      this.logger.error(
        'Invalid JSON response received from OSRM',
        error instanceof Error
          ? error.stack
          : String(error),
      );

      throw new InternalServerErrorException(
        'Invalid response received from OSRM',
      );
    }
  }

  private validateCoordinates(
    points: OsrmCoordinate[],
  ): void {
    for (const point of points) {
      if (
        !Number.isFinite(
          point.latitude,
        ) ||
        !Number.isFinite(
          point.longitude,
        )
      ) {
        throw new BadRequestException(
          'Latitude and longitude must be valid numbers',
        );
      }

      if (
        point.latitude < -90 ||
        point.latitude > 90
      ) {
        throw new BadRequestException(
          `Invalid latitude: ${point.latitude}`,
        );
      }

      if (
        point.longitude < -180 ||
        point.longitude > 180
      ) {
        throw new BadRequestException(
          `Invalid longitude: ${point.longitude}`,
        );
      }
    }
  }

  private async getErrorBody(
    response: Response,
  ): Promise<string> {
    try {
      return await response.text();
    } catch {
      return '';
    }
  }
}
