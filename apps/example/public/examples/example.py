# This is the live demo to projectional editor Puredit
# Originally developed by Niklas Korz and Artur Andrzejak (https://github.com/niklaskorz/puredit)
# Extended by Andre Trump (https://github.com/andretrump/puredit)

# On the left, you see the projectional editor and on the right, the
# underlying textual source code. Both edit the same model and any changes
# to one side are reflected directly on the other side.

# Some projections make use of the https://cortexjs.io/mathlive/ library (MIT license).
import mathdsl
import polars as pl
import torch

# Click on the blue keyboard icon to edit a mathematical expression.
# You also type directly using your keyboard. Commonly used names such as "pi"
# or "theta" are automatically replaced by their greek letters.
# Click anywhere else inside the editor to close the mathematical keyword again.

showRectangle()
showCanvas()

# 1. Example: A math term transformed into function.
# Click on the blue keyboard icon 
f, args = mathdsl.compile("20\\pi^2+\\sin x")
print("f(x):", f(x=90))

# 2. Example: A math term with a matrix.
rotate, args = mathdsl.compile("\\begin{pmatrix}\\cos\\theta & -\\sin\\theta\\\\ \\sin\\theta & \\cos\\theta\\end{pmatrix}\\begin{pmatrix}x\\\\ y\\end{pmatrix}")
print("rotate(x, y, theta):")
print(rotate(x=1, y=2, theta=0.5))

# 3. Example:
# A math term evaluated immediately, using variables from the local scope.
# You can try to define new variables in the lines before the term
# and then use them inside the equation editor.
r = 5
x = mathdsl.evaluate("r^r", locals())
print("x:", x)

# 4. Example: Projections with aggregations and chains
aggregated_weather = (weather_data.pivot(
    index=[
        "Date.Full"
    ], columns=[
        "Station.City"
    ], values=[
        "Data.Temperature.Avg Temp"
    ], aggregate_function="mean"
)
.drop_nulls())
print(aggregated_weather)

melted_weather = (weather_data.melt(
    id_vars=[
        "Station.City",
        "Date.Full"
    ], value_vars=[
        "Data.Temperature.Min Temp",
        "Data.Temperature.Max Temp",
        "Data.Temperature.Avg Temp"
    ], variable_name="Temperature Variant", value_name="Value"
))
print(melted_weather)

transformed_weather = (weather_data.select(
        pl.col("Date.Full").alias("date"),
        pl.col("Data.Temperature.Max Temp").alias("max_temperature"),
        "Station.City",
        year="Date.Year"
    )
    .drop_nulls()
    .filter(pl.col("year") > 2015)
    .group_by("Station.City")
    .agg(
        pl.max("max_temperature")
    )
    .rename({"Station.City": "city"})
    .sort("max_temperature", descending=True)
)
print(transformed_weather)

image_data = get_image_data()
print(image_data.shape)

# CONTEXT: [ "Batch", "Image", "Gray Scale Value", "Width", "Height" ]
transposed = image_data.transpose(0, 1)
print(transposed.shape)

# CONTEXT: [ "Batch", "Image", "Gray Scale Value", "Width", "Height" ]
permuted = image_data.permute(2, 3, 0, 1, 4)
print(permuted.shape)

# CONTEXT: { "Batch": 10, "Image": 1000, "Gray Scale Value": 1, "Width": 28, "Height": 28 }
slice_1 = image_data[
    5::2,
    :32:1
]
print(slice_1.shape)

#CONTEXT: { "Batch": 10, "Image": 1000, "Gray Scale Value": 1, "Width": 28, "Height": 28 }
slice_2 = image_data[
    2:9:2,
    1
]
print(slice_2.shape)