// Load all the CSV files from the data folder
Promise.all([
  d3.csv('data/data_sheet_1.csv'),
  d3.csv('data/data_sheet_2.csv'),
  d3.csv('data/data_sheet_3.csv'),
  d3.csv('data/data_sheet_4.csv'),
  d3.csv('data/data_sheet_5.csv')
]).then(dataSheets => {
  // Combine all the CSV data into one array
  const combinedData = [].concat(...dataSheets);

  // Extract the year from the year column (e.g., '2017-1' becomes '2017')
  combinedData.forEach(d => {
    d.year = +d.year.split('-')[0]; // Extract the year part from 'YYYY-MM' and convert to number
    d.resale_price = +d.resale_price; // Convert resale_price to number
  });

  // Compute the average resale price for each flat_type and year
  const averagePrices = d3.rollup(combinedData, 
    v => d3.mean(v, d => d.resale_price), 
    d => d.year, 
    d => d.flat_type);

  // Prepare the data for the line chart
  const chartData = Array.from(averagePrices, ([year, flatTypes]) => {
    return Array.from(flatTypes, ([flatType, avgPrice]) => ({
      year: year,
      flat_type: flatType,
      average_price: avgPrice
    }));
  }).flat();

  // Calculate price increase and percentage change for each flat_type
  const priceChanges = d3.groups(chartData, d => d.flat_type).map(([flatType, data]) => {
    const prices = data.sort((a, b) => a.year - b.year);
    const startPrice = prices[0]?.average_price || 0;
    const endPrice = prices[prices.length - 1]?.average_price || 0;
    const priceChange = endPrice - startPrice;
    const percentageChange = ((endPrice - startPrice) / startPrice) * 100;
    return { flatType, priceChange, percentageChange };
  });

  // Chart dimensions and margins
  const width = 800;
  const height = 390;
  const marginTop = 20;
  const marginRight = 150;
  const marginBottom = 30;
  const marginLeft = 80;

  // Create the x and y scales
  const x = d3.scaleLinear()
    .domain([1990, 2024])
    .range([marginLeft, width - marginRight]);

  const y = d3.scaleLinear()
    .domain([d3.min(chartData, d => d.average_price) * 0.9, d3.max(chartData, d => d.average_price) * 1.1])
    .range([height - marginBottom, marginTop]);

  // Group the data by flat_type
  const nestedData = d3.groups(chartData, d => d.flat_type);

  // Define your custom color palette
  const colorPalette = ["#797d62", "#9b9b7a", "#d9ae94", "#f1dca7", "#ffcb69", "#d08c60", "#997b66"];
  const color = flatType => {
    const flatTypeIndex = nestedData.findIndex(d => d[0] === flatType);
    return colorPalette[flatTypeIndex % colorPalette.length];
  };

  // Create the line generator
  const line = d3.line()
    .curve(d3.curveBasis)
    .x(d => x(d.year))
    .y(d => y(d.average_price));

  // Create the SVG container
  const svg = d3.create("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [0, 0, width, height])
    .attr("style", "max-width: 100%; height: auto; height: intrinsic;");

  // Add axes
  svg.append("g")
    .attr("transform", `translate(0,${height - marginBottom})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));

  svg.append("g")
    .attr("transform", `translate(${marginLeft},0)`)
    .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format("$,.0f")))
    .call(g => g.select(".domain").remove());

  // Add gridlines
  svg.append("g")
    .selectAll(".x-grid")
    .data(x.ticks(10))
    .join("line")
    .attr("class", "x-grid")
    .attr("x1", d => x(d))
    .attr("x2", d => x(d))
    .attr("y1", marginTop)
    .attr("y2", height - marginBottom)
    .attr("stroke", "#ccc")
    .attr("stroke-dasharray", "4,4");

  svg.append("g")
    .selectAll(".y-grid")
    .data(y.ticks(5))
    .join("line")
    .attr("class", "y-grid")
    .attr("x1", marginLeft)
    .attr("x2", width - marginRight)
    .attr("y1", d => y(d))
    .attr("y2", d => y(d))
    .attr("stroke", "#ccc")
    .attr("stroke-dasharray", "4,4");

  // Add tooltip div
  const tooltip = d3.select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("background", "white")
    .style("border", "1px solid #ccc")
    .style("padding", "10px")
    .style("visibility", "hidden")
    .style("pointer-events", "none");

  // Add lines for each flat_type
svg.selectAll(".line")
.data(nestedData)
.join("path")
.attr("class", "line")
.attr("fill", "none")
.attr("stroke", d => color(d[0]))
.attr("stroke-width", 3)
.attr("d", d => line(d[1]))
.style("transition", "opacity 0.3s ease") // Smooth transition for opacity
.on("mouseover", function(event, d) {
  const flatType = d[0];
  const { priceChange, percentageChange } = priceChanges.find(p => p.flatType === flatType);

  // Highlight the hovered line
  d3.selectAll(".line").style("opacity", 0.2); // Fade out all lines
  d3.select(this).style("opacity", 1).style("stroke-width", 4); // Highlight the current line

  // Show tooltip
  tooltip.style("visibility", "visible")
    .html(`<strong>${flatType}</strong><br>
          Price increased: ${d3.format("$,.0f")(priceChange)}<br>
          Percentage: ${percentageChange.toFixed(2)}%`);
})
.on("mousemove", event => {
  tooltip.style("top", (event.pageY + 10) + "px")
    .style("left", (event.pageX + 10) + "px");
})
.on("mouseout", function() {
  // Reset opacity and stroke-width for all lines
  d3.selectAll(".line").style("opacity", 1).style("stroke-width", 3);

  // Hide tooltip
  tooltip.style("visibility", "hidden");
});

// Add legend
const legend = svg.append("g")
  .attr("transform", `translate(${width - marginRight + 20}, ${marginTop})`);

// Adjusting the size of the square box and making the edges rounded, and position closer together
legend.selectAll("rect")
  .data(nestedData)
  .join("rect")
  .attr("x", 0)
  .attr("y", (d, i) => i * 15) // reduce the spacing between legend items
  .attr("width", 10) // smaller width
  .attr("height", 10) // smaller height
  .attr("rx", 3) // rounded edges with a radius of 3
  .attr("ry", 3) // rounded edges with a radius of 3
  .attr("fill", d => color(d[0])) // original color for square box

// Adjusting the font size of the legend text and making it closer
legend.selectAll("text")
  .data(nestedData)
  .join("text")
  .attr("x", 15) // Adjust x position for smaller box
  .attr("y", (d, i) => i * 15 + 7) // reduce the spacing and align with the box
  .text(d => d[0])
  .attr("font-size", "10px") // smaller font size
  .attr("alignment-baseline", "middle")
  .attr("fill", "#333") // dark grey text color

  // Append the SVG element to the DOM
  document.getElementById("chart-container").appendChild(svg.node());
});