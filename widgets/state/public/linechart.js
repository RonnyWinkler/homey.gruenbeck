// Set dimensions and margins for the chart
const margin = { top: 0, right: 20, bottom: 0, left: 0 };
const width = 160 - margin.left - margin.right;
const height = 80 - margin.top - margin.bottom;

// Set up the x and y scales

const x = d3.scaleTime()
  .range([0, width]);

const y = d3.scaleLinear()
  .range([height, 0]);

// Create the SVG element and append it to the chart container

const svg = d3.select("#d3_chart")
  .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

function drawChart(data){
    svg.selectAll("*").remove();

    // Parse the date and convert the population to a number
    let chartData = [];
    data.forEach( (element) => chartData.push({date: new Date(element.timestamp), value: element.value}) );
  
    // function parseDate(string){
    //     return new Date(string);
    // }
    // data.forEach(d => {
    //     d.date = parseDate(d.date);
    //     // d.population = +d.population;
    // });

    // Define the x and y domains

    x.domain(d3.extent(chartData, d => d.date));
    y.domain([0, d3.max(chartData, d => d.value)]);

    // Add the x-axis
    // svg.append("g")
    //   .attr("transform", `translate(0,${height})`)
    //   .call(d3.axisBottom(x)
    //     // .ticks(d3.timeMinute.every(60)) 
    //     // .tickFormat(d3.timeFormat("%I:%M"))
    //     ); 


    // Add the y-axis
    svg.append("g")
    .attr("transform", `translate(${width},0)`)
    .call(d3.axisRight(y)
        .tickSize(3)
        .tickPadding(5)
        .ticks(10) )

    // Create the line generator

    const line = d3.line()
    .x(d => x(d.date))
    .y(d => y(d.value));

    // Add the line path to the SVG element

    svg.append("path")
    .datum(chartData)
    .attr("fill", "none")
    .attr("stroke", "steelblue")
    .attr("stroke-width", 1)
    .attr("d", line);
}

