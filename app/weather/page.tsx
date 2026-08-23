import { WeatherPage } from "../../src/modules/weather/WeatherPage";
import { WeatherAgriculturePage } from "../../src/modules/agriculture/WeatherAgriculturePage";

export default function WeatherRoute() {
  return <WeatherAgriculturePage weatherPage={<WeatherPage embedded />} />;
}
