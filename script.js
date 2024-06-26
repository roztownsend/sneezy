import { getLocation } from "./forecast";
import { getAirQuality } from "./forecast";
import { getDaily } from "./forecast";

const formElement = document.querySelector("[data-form]");
const inputLocationElement = document.querySelector("[data-location]");
const displayLocationElement = document.querySelector("[data-return-location]");

let hourlyData;
let latitude;
let longitude;
let locationName;
let countryName;
let hasPreviousForecast = false;

async function fetchData() {
    try {
        const locationInput = inputLocationElement.value.trim();
        const response = await getLocation(locationInput);
        if (response.data.results === undefined) {
            alert("We can't find your location. The search only takes English characters, so make sure to check your spelling.");
            throw new Error("Location not found");
        };
        latitude = response.data.results[0].latitude;
        longitude = response.data.results[0].longitude;
        locationName = response.data.results[0].name;
        countryName = response.data.results[0].country;
        const timezone = response.data.results[0].timezone;
        if (!timezone.startsWith("Europe")) {
            alert(`We see that ${locationName}, ${countryName} is outside of Europe. We only have forecasts available for Europe at this time. Please check back soon.`);
            throw new Error("Location outside Europe.")
        };
        const airQualityResponse = await getAirQuality(latitude, longitude);
        const currentTimezone = airQualityResponse.timezone;
        hourlyData = airQualityResponse.hourly;
        renderPollenAndAqi(hourlyData, currentTimezone, locationName, countryName);
        
        const dailyResponse = await getDaily(latitude, longitude);
        renderDaily(dailyResponse.daily);
        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
};

window.addEventListener("unload", () => {
    formElement.reset();
})

//stop body scrolling when the modal is open or on initial load
const bodyScrolling = (cantScroll) => {
    if (cantScroll) {
    document.body.classList.add("body-scrolling");
    } else {
    document.body.classList.remove("body-scrolling");
    }
};

let currentHoursRow;
let hourlySection = document.querySelector("[data-hourly-table]");

const scrollToRow = () => {
currentHoursRow = hourlySection.getElementsByClassName("hourly-table__row-current")[0];
hourlySection.scrollTo(0, currentHoursRow.offsetTop - 300);
}

const bodyElement = document.querySelector("[data-body]");
const headerElement = document.querySelector("[data-header]");
const contentElement = document.querySelector("[data-content]");
const sectionsElements = document.querySelectorAll("section");

//to-do: calc scrollbar width and subtract from body


const submitHandler = event => {
    event.preventDefault();
    if (hasPreviousForecast) {
        sectionsElements.forEach(section => {
            section.classList.remove("show-new-content");
          });
        sectionsElements.forEach(section => {
            section.classList.add("hide-new-content");
          });
          setTimeout(() => {
              fetchData()
              .then(success => {
                if (success) {
                    sectionsElements.forEach(section => {
                      section.classList.add("show-new-content");
                      section.classList.remove("hide-new-content");
                  });
                } else {
                    return;
                }
              })
        }, 500);
    } else {
        fetchData()
        .then(success => {
            if (success) {
                let cantScroll = false;
                bodyScrolling(cantScroll);
                headerElement.classList.add("header-rollback");
                setTimeout(() => {
                    headerElement.style.position = "relative";
                    contentElement.classList.add("show-content");
                    contentElement.classList.remove("hide-content");
                }, 550)
                hasPreviousForecast = true;
            } else {
                hasPreviousForecast = false;
                return;
            }
          });
    }

    window.scrollTo({top: 0, behavior: "smooth"});
};

formElement.addEventListener("submit", submitHandler);

//set values and code more easily
function setValues(selector, value, { parent = document } = {}) {
    parent.querySelector(`[data-${selector}]`).textContent = value;
};

function setCode(selector, value, { parent = document } = {}) {
    parent.querySelector(`[data-${selector}]`).innerHTML = value;
};

//CSS class additions

const levelColorMapping = {
    low: "low",
    fair: "fair",
    good: "good",
    medium: "medium",
    moderate: "moderate",
    high: "high",
    poor: "poor",
    hazardous: "hazardous",
    "extremely poor": "extremely-poor",
    "out of season": "out-of-season"
};

function setLevelColors(selector, readingLevel, levelElement) {
    let levelColorClass = levelColorMapping[readingLevel];
    if (levelColorClass) {
        levelElement.querySelector(`[data-${selector}]`).classList
            .add(levelColorClass);
    }
};

function setPollenBackgroundClass(
    selector, pollenKey, pollenElement, fullObject) {
    const allPollenKeys = Object.keys(fullObject);
    if (pollenKey) {
        pollenElement.querySelector(`[data-${selector}]`).classList
            .remove(...allPollenKeys);
        pollenElement.querySelector(`[data-${selector}]`).classList
            .add(pollenKey);
    }
};

const currentSection = document.querySelector("[data-forecast-cardspread]");
const pollenCard = document.getElementById("forecast-card");
const forecastModal = document.querySelector("[data-forecast-modal]");
const closeModal = document.querySelector("[data-close-modal");
const closeModalButton = document.querySelector("[data-close-modal-button");

function renderCards(
    currentHour, 
    pollenKeys, 
    hourlyTimestamps, 
    hourlyPollenData, 
    currentHourTimestamp) {
    currentSection.innerHTML = "";
    let currentHoursReading = currentHour;
    for (const key of pollenKeys) {
        const nestedObject = currentHour[key];
        const nestedKeys = Object.keys(nestedObject)
        const pollenLevel = nestedObject[nestedKeys[0]];
        const pollenGrains = nestedObject[nestedKeys[1]];
        const pollenElement = pollenCard.content.cloneNode(true);
        setValues("pollen-label", key, { parent: pollenElement });
        setValues("pollen-level", pollenLevel, { parent: pollenElement });
        const openForecastModal = pollenElement.querySelector("[data-forecast-link]");
        if (pollenGrains == null) {
            setValues("pollen-grains", `0 Grains/m³`, { parent: pollenElement });
            setValues("forecast-link", "No current forecast", {parent: pollenElement});
            pollenElement.querySelector("[data-forecast-link]").classList.add("no-link");
        } else {
            openForecastModal.addEventListener("click", function(event) {
                event.preventDefault();
                const keyArray = [key];
                renderReadingsTable(hourlyTimestamps, hourlyPollenData, keyArray, currentHourTimestamp);
                let cantScroll = true;
                bodyScrolling(cantScroll);
                forecastModal.showModal();
                closeModalButton.blur();
                scrollToRow();
            });
            setValues("pollen-grains",
                `${pollenGrains} Grains/m³`,
                { parent: pollenElement });
            setCode("forecast-link",
                `<a class="light-link" href="#" data-modal="full-day-${key}">See full-day forecast</a>`,
                { parent: pollenElement });
        }
        setLevelColors("pollen-level", pollenLevel, pollenElement);
        setPollenBackgroundClass("forecast-card", key, pollenElement, currentHoursReading)
        currentSection.append(pollenElement);
    } 
};

const aqiSection = document.querySelector("[data-aqi-spread]");
const aqiDatapoint = document.getElementById("aqi-datapoint");

function renderCurrentHoursAqiData(aqiData, aqiKeys) {
    aqiSection.innerHTML = "";
    for (const key of aqiKeys) {
        const nestedObject = aqiData[key];
        const nestedKeys = Object.keys(nestedObject);
        const aqiLabels = nestedObject[nestedKeys[0]];
        const aqiDigits = nestedObject[nestedKeys[1]];
        const aqiLevel = nestedObject[nestedKeys[2]];
        const aqiElement = aqiDatapoint.content.cloneNode(true);
        setValues("aqi-label", aqiLabels, { parent: aqiElement });
        setValues("aqi-level", aqiLevel, { parent: aqiElement });
        setValues("aqi-digits", aqiDigits, { parent: aqiElement });
        setLevelColors("aqi-level", aqiLevel, aqiElement);
        aqiSection.append(aqiElement);
    }
};

//modal rendering and tables
const tableHeadersSection = document.querySelector("[data-table-headers]");
const tableHeader = document.getElementById("hourly-table-headers");

function renderTableHeaders(fullDayObject, objectKey) {
    let gatheredHeaders = [];
    
    if (objectKey.length === 1) {
    gatheredHeaders = ["Hours", "Level", "Grains/m³"];
    gatheredHeaders.forEach(label => {
        const tableHeaderElement = tableHeader.content.cloneNode(true);
        setValues("header-label", label, { parent: tableHeaderElement })
        tableHeadersSection.append(tableHeaderElement);
        });
        return;
    } else {
        tableHeadersSection.innerHTML = "";    
        for (objectKey in fullDayObject) {
            const headerLabel = fullDayObject[objectKey][`${objectKey}_label`];
            gatheredHeaders.push(headerLabel);
        }
        gatheredHeaders.unshift("Hours");
        gatheredHeaders.forEach(label => {
            const tableHeaderElement = tableHeader.content.cloneNode(true);
            setValues("header-label", label, { parent: tableHeaderElement })
            tableHeadersSection.append(tableHeaderElement);
            });
    }
};

const modalSection = document.querySelector("[data-modal-section]");
const hourlyRow = document.getElementById("hourly-table-row");
const hourlyHeader = document.querySelector("[data-pollen-label]");
const currentDateRaw = new Date();
const currentDateFormatted = currentDateRaw.toLocaleString([], 
    {day: "numeric", weekday: "long", month: "long"});
    
closeModal.addEventListener("click", () => {
    tableHeadersSection.innerHTML = "";
    hourlySection.innerHTML = "";
    let cantScroll = false;
    bodyScrolling(cantScroll);
    forecastModal.close();
});

function outOfSeasonFilter(fullDayObject, objectKey) {
    //remove out-of-season pollens from fullDayObject in table columns
    if (objectKey.length === 1) {
        return objectKey;
    } else {
    let filteredArray;
        for (objectKey in fullDayObject) {
            const readingArray = fullDayObject[objectKey][objectKey];
            if (readingArray.every(item => item === null)) {
                delete fullDayObject[objectKey];
                console.log(`${objectKey} is out of season!`)
            }
        }
        filteredArray = Object.keys(fullDayObject);
        return filteredArray;
        }
    }

    
function renderReadingsTable(
    hourlyTimestamps, 
    fullDayObject, 
    objectKey, 
    currentHourTimestamp) {
    const filteredObjectKey = outOfSeasonFilter(fullDayObject, objectKey);
    renderTableHeaders(fullDayObject, filteredObjectKey);
    const minLength = hourlyTimestamps.length;
    const objectLength = filteredObjectKey.length;        
    let formattedArray = Array(objectLength);
    let currentIndex = 0;
    for (let i = 0;
        i < minLength;
        i++) {
            let rowLevel;
            let rowReading;
            const rowTimestamp = hourlyTimestamps[i];
            let rowTimestampTd = `<td>${rowTimestamp}</td>`;
            let formattedTd = "";
            let fullRowTds;
            let levelColorClass;
            const hourlyTableElement = hourlyRow.content.cloneNode(true);
            if (objectLength === 1) {
                setPollenBackgroundClass(
                    "forecast-modal", objectKey, modalSection, fullDayObject);
                rowLevel = fullDayObject[objectKey][`${objectKey}_level`][i];
                rowReading = fullDayObject[objectKey][objectKey][i];
                hourlyHeader.textContent = `${objectKey} forecast: ${currentDateFormatted}`;
                levelColorClass = levelColorMapping[rowLevel];
                formattedTd =
                `
                <td class="${levelColorClass}">${rowLevel}</td>
                <td>${rowReading}</td>
                `;
            } else if (objectLength > 1) {
                    forecastModal.classList = "forecast-modal";
                for (objectKey in fullDayObject) {
                    hourlyHeader.textContent = `Full day forecast: ${currentDateFormatted}`;
                    rowLevel = fullDayObject[objectKey][`${objectKey}_level`][i];
                    rowReading = fullDayObject[objectKey][objectKey][i];
                    levelColorClass = levelColorMapping[rowLevel];
                    formattedTd += `
                        <td><span class="${levelColorClass}">${rowLevel}</span>
                        <br>(${rowReading})</td>
                        `;
                        currentIndex++;
                        }
                    }
                    formattedArray[currentIndex] = formattedTd.trim();
                    currentIndex++;
                        const subsequentDataPoints = 
                        formattedArray.slice(currentIndex - objectLength, currentIndex);
                        const cleanedDataPoints = subsequentDataPoints.map((td) => td.trim())
                        fullRowTds = rowTimestampTd + cleanedDataPoints.join("");
                        setCode("table-row", fullRowTds, { parent: hourlyTableElement });
            if (rowTimestamp == currentHourTimestamp) {
                const previousCurrentHoursRow = hourlySection.querySelector(".hourly-table__row-current");
                if (previousCurrentHoursRow) {
                    previousCurrentHoursRow.classList.remove("hourly-table__row-current");}
                currentHoursRow = hourlyTableElement.querySelector("[data-table-row]");
                currentHoursRow.classList.add("hourly-table__row-current");
            };
            hourlySection.append(hourlyTableElement);
        }
};
        
const fullPollensModalLink = document.querySelector("[data-fullpollen-modal]");
const aqiModalLink = document.querySelector("[data-aqi-modal]");
        
function renderPollenAndAqi(hourlyData, currentTimezone, locationName, countryName) {
    const {
        timestamps: {current_hour: currentHourTimestamp, timestamp: hourlyTimestamps},
        currentHoursPollensReading: currentHour,
        fullDayPollenReadings: hourlyPollenData,
        currentHoursAqiReading: currentAqiData,
        fullDayAqi: aqiFullDay
    } = hourlyData;

    //render headers
    const rawTime = new Date();
    const asOfTimestamp = `${rawTime.toLocaleTimeString([], 
        { hour: "2-digit", minute: "2-digit" })}`;
    displayLocationElement.textContent = 
    `Why you're sneezing in ${locationName}, ${countryName}`
    document.querySelector("[data-as-of-time]").textContent = 
    `As of ${asOfTimestamp} ${currentTimezone}`;
    const pollenKeys = Object.keys(currentHour);

    //render current hour's pollen cards
    renderCards(
        currentHour, pollenKeys, hourlyTimestamps, hourlyPollenData, currentHourTimestamp);
    fullPollensModalLink.addEventListener("click", function(event) {
        event.preventDefault();
        renderReadingsTable(
            hourlyTimestamps, hourlyPollenData, pollenKeys, currentHourTimestamp);
        let cantScroll = true;
        bodyScrolling(cantScroll);
        forecastModal.showModal();
        closeModalButton.blur();
        scrollToRow();
        }
    );

    //render current hours's AQI
    const aqiKeys = Object.keys(currentAqiData);
    renderCurrentHoursAqiData(currentAqiData, aqiKeys);
    aqiModalLink.addEventListener("click", function(event) {
        event.preventDefault();
        renderReadingsTable(
            hourlyTimestamps, aqiFullDay, aqiKeys, currentHourTimestamp);
        let cantScroll = true;
        bodyScrolling(cantScroll);
        forecastModal.showModal();
        closeModalButton.blur();
        scrollToRow();
    }
    );
};

//Render today's weather
function renderDaily({ 
    weatherCode,
    weatherIcon,
    weatherLabel,
    highTemp, 
    lowTemp, 
    precipProbability, 
    precipSum, 
    windSpeed, 
    windDirection }) {
    const windDegrees = windDirection;
    setCode("weather-icon", `<img src="${weatherIcon}">`, document);
    setValues("weather-label", weatherLabel, document);
    setValues("high-temp", highTemp, document);
    setValues("low-temp", lowTemp, document);
    setValues("precipitation-probability", precipProbability, document);
    setValues("precipitation-sum", precipSum, document);
    setValues("max-windspeed", windSpeed, document);
    setValues("wind-direction", windDegrees, document);
    setValues("wind-direction-name", getWindDirection(windDegrees), document);
};

function getWindDirection(windDegrees) {
    switch (true) {
    case windDegrees >= 337.5 || windDegrees < 22.5:
        return 'North';
    case windDegrees >= 22.5 && windDegrees < 67.5:
        return 'Northeast';
    case windDegrees >= 67.5 && windDegrees < 112.5:
        return 'East';
    case windDegrees >= 112.5 && windDegrees < 157.5:
        return 'Southeast';
    case windDegrees >= 157.5 && windDegrees < 202.5:
        return 'South';
    case windDegrees >= 202.5 && windDegrees < 247.5:
        return 'Southwest';
    case windDegrees >= 247.5 && windDegrees < 292.5:
        return 'West';
    case windDegrees >= 292.5 && windDegrees < 337.5:
        return 'Northwest';
    default:
        return 'Degree value is invalid.';
    };
};

const backToTopButton = document.querySelector("[data-back-to-top]")

backToTopButton.addEventListener("click", function() {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  });