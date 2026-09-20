import { Injectable } from '@nestjs/common';
import {
  OsrmClient,
  OsrmCoordinate,
  OsrmRoute,
  OsrmRouteLeg,
  OsrmRouteStep,
} from './osrm.client';

export interface RideRouteInstruction {
  text: string;
  distance: number;
  duration: number;
  type?: string;
  modifier?: string;
  location?: number[];
}

export interface RideRoute {
  distance: number;
  duration: number;

  distanceMeters: number;
  durationSeconds: number;

  geometry?: OsrmRoute['geometry'];

  legs?: OsrmRouteLeg[];

  steps?: OsrmRouteStep[];

  instructions: RideRouteInstruction[];
}

@Injectable()
export class RoutingService {
  constructor(
    private readonly osrmClient: OsrmClient,
  ) {}


  async getDriverToPickupRoute(
    driver: OsrmCoordinate,
    pickup: OsrmCoordinate,
  ): Promise<RideRoute> {
    const route =
      await this.osrmClient.getRoute(
        driver,
        pickup,
        {
          overview: 'full',
          geometries: 'geojson',
          steps: true,
          alternatives: false,
        },
      );

    return this.formatRoute(route);
  }


  async getRideRoute(
    pickup: OsrmCoordinate,
    destination: OsrmCoordinate,
  ): Promise<RideRoute> {
    const route =
      await this.osrmClient.getRoute(
        pickup,
        destination,
        {
          overview: 'full',
          geometries: 'geojson',
          steps: true,
          alternatives: false,
        },
      );

    return this.formatRoute(route);
  }


  async getCompleteRideRoute(
    driver: OsrmCoordinate,
    pickup: OsrmCoordinate,
    destination: OsrmCoordinate,
  ): Promise<RideRoute> {
    const route =
      await this.osrmClient.getRouteThroughPoints(
        [
          driver,
          pickup,
          destination,
        ],
        {
          overview: 'full',
          geometries: 'geojson',
          steps: true,
          alternatives: false,
        },
      );

    return this.formatRoute(route);
  }


  async getMultiStopRoute(
    points: OsrmCoordinate[],
  ): Promise<RideRoute> {
    if (points.length < 2) {
      throw new Error(
        'At least two coordinates are required to calculate a route',
      );
    }

    const route =
      await this.osrmClient.getRouteThroughPoints(
        points,
        {
          overview: 'full',
          geometries: 'geojson',
          steps: true,
          alternatives: false,
        },
      );

    return this.formatRoute(route);
  }


  private formatRoute(
    route: OsrmRoute,
  ): RideRoute {
    const steps =
      route.legs?.flatMap(
        (leg) =>
          leg.steps ?? [],
      ) ?? [];

    const instructions =
      steps.map(
        (step) =>
          this.formatInstruction(step),
      );

    return {
      distance: route.distance,
      duration: route.duration,

      distanceMeters:
        route.distance,

      durationSeconds:
        route.duration,

      geometry:
        route.geometry,

      legs:
        route.legs,

      steps,

      instructions,
    };
  }


  private formatInstruction(
    step: OsrmRouteStep,
  ): RideRouteInstruction {
    const type =
      step.maneuver?.type;

    const modifier =
      step.maneuver?.modifier;

    const roadName =
      step.name?.trim();

    let text = '';

    if (
      type === 'depart'
    ) {
      text = roadName
        ? `Depart on ${roadName}`
        : 'Depart';
    } else if (
      type === 'arrive'
    ) {
      text = 'Arrive at destination';
    } else if (
      type === 'turn'
    ) {
      text = modifier
        ? `Turn ${modifier}${roadName ? ` onto ${roadName}` : ''}`
        : `Turn${roadName ? ` onto ${roadName}` : ''}`;
    } else if (
      type === 'continue'
    ) {
      text = roadName
        ? `Continue on ${roadName}`
        : 'Continue';
    } else if (
      type === 'merge'
    ) {
      text = roadName
        ? `Merge onto ${roadName}`
        : 'Merge';
    } else if (
      type === 'fork'
    ) {
      text = modifier
        ? `Keep ${modifier}${roadName ? ` onto ${roadName}` : ''}`
        : `Keep${roadName ? ` onto ${roadName}` : ''}`;
    } else if (
      type === 'roundabout' ||
      type === 'rotary'
    ) {
      text = roadName
        ? `Enter roundabout onto ${roadName}`
        : 'Enter roundabout';
    } else if (
      type === 'new name'
    ) {
      text = roadName
        ? `Continue onto ${roadName}`
        : 'Continue';
    } else {
      text = roadName
        ? `Continue on ${roadName}`
        : 'Continue';
    }

    return {
      text,
      distance: step.distance,
      duration: step.duration,
      type,
      modifier,
      location:
        step.maneuver?.location,
    };
  }
}
