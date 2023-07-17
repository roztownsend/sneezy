import axios from "axios";

export function getTimezone(name) {
    return axios
    .get("https://geocoding-api.open-meteo.com/v1/search",
        {params: {
            name: name,
            count: 1,
            format: "json"
            },
        })
    .catch(error => {
        if (error.response) {
          // Handle HTTP response status codes
          if (error.response.status === 404) {
            throw new Error("Can't find the location to get the timezone.");
          } else {
            throw new Error("An error occurred during the API request.");
          }
        } else {
          throw new Error("An error occurred while trying to communitcate with the server.");
        }
      });
};

export function getAirQuality(latitude, longitude) {
    const rawDate = new Date();
    const paramDates = rawDate.toISOString().split('T')[0];
    return axios
        .get("https://air-quality-api.open-meteo.com/v1/air-quality", 
        {params: {
            latitude: latitude,
            longitude: longitude,
            hourly: "pm2_5,aerosol_optical_depth,alder_pollen,birch_pollen," + 
            "grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen,european_aqi",
            timezone: "auto",
            start_date: paramDates,
            end_date: paramDates
            }
        })
        .then(({ data }) => {
            console.log(data)
            const timezone = data.timezone_abbreviation;
            const hourlyData = parseAirQuality(data);
            return {
                timezone: timezone,
                hourly: hourlyData
            };
        })
        .catch(error => {
            console.error(error);
            throw new Error("There was an error getting the pollen and air quality data.")
        });
};

export const pollenRanges = {
    alder_digits: {
        low: [0.00, 14.9],
        medium: [15, 89.9],
        high: [90, 1499.9],
        hazardous: [1500, 999999]
    },
    birch_digits: {
        low: [0.00, 14.9],
        medium: [15, 89.9],
        high: [90, 1499.9],
        hazardous: [1500, 999999]
    },
    olive_digits: {
        low: [0.00, 14.9],
        medium: [15, 89.9],
        high: [90, 1499.9],
        hazardous: [1500, 999999]
    },
    grass_digits: {
        low: [0.00, 4.9],
        medium: [5, 19.9],
        high: [20, 199.9],
        hazardous: [200, 999999]
    },
    mugwort_digits: {
        low: [0.00, 9.9],
        medium: [10, 49.9],
        high: [50, 499.9],
        hazardous: [500, 999999]
    },
    ragweed_digits: {
        low: [0.00, 9.9],
        medium: [10, 49.9],
        high: [50, 499.9],
        hazardous: [500, 999999]
    }
};

const aqiRanges = {
    pm_digits: {
        good: [0.00, 9.9],
        fair: [10, 19.9],
        moderate: [20, 24.9],
        poor: [25, 49.9],
        very_poor: [50, 74.9],
        extremely_poor: [75, 999999]
    },
    haze_digits: {
        low: [0.00, 0.29],
        moderate: [0.30, 0.54],
        high: [0.55, 0.74],
        very_high: [0.75, 999999]
    },
    aqi_digits: {
        good: [0.00, 19.9],
        fair: [20, 39.9],
        moderate: [40, 59.9],
        poor: [60, 79.9],
        very_poor: [80, 99.9],
        extremely_poor: [100, 999999]
    }
};

const labels = {
    aqiLabels: {
        pm_label: "Particulate Matter 2.5 (Grains/m³)",
        haze_label: "Aerosol Optical Depth (Haze)",
        aqi_label: "European Air Quality Index"
    },
    pollenLabels: {
        alder_label: "Alder",
        birch_label: "Birch",
        grass_label: "Grass",
        mugwort_label: "Mugwort",
        olive_label: "Olive",
        ragweed_label: "Ragweed",
    }
};

function mapFullDayLevelRanges(readingArraysObj, pollenRanges, index) {
    let pollenRangesResult = {};
    for (const key in readingArraysObj) {
      const value = readingArraysObj[key];
      const pollenRangeKey = key + "_digits";
      const newKey = key + "_level";
      pollenRangesResult[newKey] = [];
      value.forEach((reading) => {
        let foundRange = false;
        for (const pollenRange in pollenRanges[pollenRangeKey]) {
          const [min, max] = pollenRanges[pollenRangeKey][pollenRange];
        if (reading >= min && reading <= max) {
            if (reading === null) {
                pollenRangesResult[newKey].push("out of season");
                foundRange = true;
            } else {
            pollenRangesResult[newKey].push(pollenRange);
            foundRange = true;
          }
        }
    }
    if (!foundRange) {
        pollenRangesResult[newKey].push("range level not found");
        }
    });
    if (index !== undefined) {
    pollenRangesResult[newKey] = [pollenRangesResult[newKey][index]]
        }
    } 
    return pollenRangesResult;
};

function mergeMappedObjects(array) {
    return array.reduce((result, object) => {
        for (const key in object) {
            const prefix = key.split("_")[0];
            if (!result[prefix]) {
                result[prefix] = {};
            }
            result[prefix][key] = object[key];
        }
        return result;
    }, {});
}

function parseAirQuality({ hourly }) {
    const currentTime = new Date().getHours();
    let {
        time: hour,
        pm2_5: particulateMatter,
        aerosol_optical_depth: aerosolOpticalDepth,
        european_aqi: europeanAirQuality,
        alder_pollen: alderIndex,
        birch_pollen: birchIndex,
        grass_pollen: grassIndex,
        mugwort_pollen: mugwortIndex,
        olive_pollen: oliveIndex,
        ragweed_pollen: ragweedIndex
    } = hourly;
    //timestamp arrays and objs
    const hours = hour;
    const hourlyIndex = hours.map(hour => 
        parseInt(hour.split("T")[1].substring(0,2), 10));
    const hourlyTimeStamp = hours.map(hour => 
        hour.split("T")[1].substring(0,5));
    const currentHoursIndex = hourlyIndex[currentTime];
    const timestamps = {
        current_hour: hourlyTimeStamp[currentTime],
        timestamp: hourlyTimeStamp
    };
    
    //pollen readings for 24 hours
    const pollenFullDay = {
        alder: alderIndex,
        birch: birchIndex,
        grass: grassIndex,
        mugwort: mugwortIndex,
        olive: oliveIndex,
        ragweed: ragweedIndex};
    const fullDayPollenLevels = mapFullDayLevelRanges(pollenFullDay, pollenRanges);
    const fullDayPollenArray = [pollenFullDay, fullDayPollenLevels, labels.pollenLabels];
    const fullDayPollenReadings = mergeMappedObjects(fullDayPollenArray);

    //current hour's pollen readings
    const currentPollenDigits = {
        alder_pollen_digits: alderIndex[currentTime],
        birch_pollen_digits: birchIndex[currentTime],
        grass_pollen_digits: grassIndex[currentTime],
        mugwort_pollen_digits: mugwortIndex[currentTime],
        olive_pollen_digits: oliveIndex[currentTime],
        ragweed_pollen_digits: ragweedIndex[currentTime]};
    const currentHoursPollenLevels = mapFullDayLevelRanges(pollenFullDay, pollenRanges, currentHoursIndex);
    const currentHoursPollenReadingArray = [currentHoursPollenLevels, currentPollenDigits, labels.pollenLabels];
    const currentHoursPollensReading = mergeMappedObjects(currentHoursPollenReadingArray);
    
    //current hour's aqi data
    const currentHoursAqiDigits = {
        pm: particulateMatter[currentTime],
        haze: aerosolOpticalDepth[currentTime],
        aqi: europeanAirQuality[currentTime]
    };
    const airQualityData = {
        pm: particulateMatter,
        haze: aerosolOpticalDepth,
        aqi: europeanAirQuality
    };

    //AQI readings for 24 hours
    const mappedFullDayAqiReadings = mapFullDayLevelRanges(airQualityData, aqiRanges)
    const fullDayAqiReadingsArray = [mappedFullDayAqiReadings, airQualityData, labels.aqiLabels];
    const fullDayAqi = mergeMappedObjects(fullDayAqiReadingsArray);
   
    //current hours AQI readings
    const currentHoursAqiLevels = mapFullDayLevelRanges(airQualityData, aqiRanges, currentHoursIndex);
    const currentHoursAqiReadingsArray = [labels.aqiLabels, currentHoursAqiDigits,  currentHoursAqiLevels]
    const currentHoursAqiReading = mergeMappedObjects(currentHoursAqiReadingsArray);
    return {fullDayPollenReadings,
            currentHoursPollensReading,
            pollenFullDay,
            fullDayAqi,
            currentHoursAqiReading,
            timestamps
        }
    };

export function getDaily(latitude, longitude) {
    return axios.get("https://api.open-meteo.com/v1/forecast",
    {params: {
        latitude: latitude,
        longitude: longitude,
        daily: "weathercode,temperature_2m_max,temperature_2m_min,windspeed_10m_max,winddirection_10m_dominant,precipitation_sum,precipitation_probability_max",
        windspeed_unit: "ms",
        timezone: "auto"
        },
    }).then(({ data }) => {
        return {
            daily: parseDaily(data)}
    })    
}

function parseDaily({ daily }) {
    const {
        weathercode: [weathercode],
        temperature_2m_max: [maxTemp], 
        temperature_2m_min: [minTemp], 
        precipitation_sum: [precipSum],
        precipitation_probability_max: [maxPrecip],
        windspeed_10m_max: [maxWindspeed], 
        winddirection_10m_dominant: [windDirection]
    } = daily;
    return {
        weathercode: weathercode,
        highTemp: maxTemp,
        lowTemp: minTemp,
        precipProbability: maxPrecip,
        precipSum: precipSum,
        windSpeed: maxWindspeed,
        windDirection: windDirection
    }
};