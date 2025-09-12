import plotly.express as px
import plotly.graph_objects as go
import pandas as pd
import numpy as np

# Create the data from your document
data = {
    'Country': ['Ghana', 'Nigeria', 'Liberia', 'Cameroon', 'Ethiopia', 'Kenya', 
                'South Africa', 'Sierra Leone', 'Democratic Republic of the Congo', 
                'Lesotho', 'Gabon', 'Zimbabwe', 'Madagascar', 'Togo', 'Eritrea', 
                'South Sudan', 'Botswana', 'Benin', 'Malawi', 'Burkina Faso', 
                'Mozambique', 'Tanzania', 'Egypt', 'Morocco'],
    'Expert_Response_%': [36.46, 12.50, 11.46, 5.21, 4.17, 4.17, 4.17, 3.13, 
                          2.08, 2.08, 1.04, 1.04, 1.04, 1.04, 1.04, 1.04, 
                          1.04, 1.04, 1.04, 1.04, 1.04, 1.04, 1.04, 1.04],
    # ISO-3 country codes
    'iso_alpha': ['GHA', 'NGA', 'LBR', 'CMR', 'ETH', 'KEN', 
                  'ZAF', 'SLE', 'COD', 'LSO', 'GAB', 'ZWE', 
                  'MDG', 'TGO', 'ERI', 'SSD', 'BWA', 'BEN', 
                  'MWI', 'BFA', 'MOZ', 'TZA', 'EGY', 'MAR']
}

df = pd.DataFrame(data)

# Country coordinates for label placement (approximate centers)
country_coords = {
    'Ghana': {'lat': 7.9, 'lon': -1.0},
    'Nigeria': {'lat': 9.0, 'lon': 8.0},
    'Liberia': {'lat': 6.5, 'lon': -9.5},
    'Cameroon': {'lat': 6.0, 'lon': 12.5},
    'Ethiopia': {'lat': 9.0, 'lon': 39.0},
    'Kenya': {'lat': -0.5, 'lon': 38.0},
    'South Africa': {'lat': -29.0, 'lon': 24.0},
    'Sierra Leone': {'lat': 8.5, 'lon': -12.0},
    'Democratic Republic of the Congo': {'lat': -3.0, 'lon': 23.0},
    'Lesotho': {'lat': -29.5, 'lon': 28.5},
    'Gabon': {'lat': -0.5, 'lon': 11.5},
    'Zimbabwe': {'lat': -19.0, 'lon': 29.5},
    'Madagascar': {'lat': -19.0, 'lon': 46.5},
    'Togo': {'lat': 8.5, 'lon': 1.0},
    'Eritrea': {'lat': 15.5, 'lon': 39.0},
    'South Sudan': {'lat': 7.0, 'lon': 30.0},
    'Botswana': {'lat': -22.0, 'lon': 24.0},
    'Benin': {'lat': 9.5, 'lon': 2.3},
    'Malawi': {'lat': -13.5, 'lon': 34.0},
    'Burkina Faso': {'lat': 12.5, 'lon': -1.5},
    'Mozambique': {'lat': -18.0, 'lon': 35.0},
    'Tanzania': {'lat': -6.5, 'lon': 35.0},
    'Egypt': {'lat': 26.0, 'lon': 30.0},
    'Morocco': {'lat': 32.0, 'lon': -6.0}
}

# Create a custom color scale
purple_orange_scale = [
    [0.0, '#f5f5f5'],     # Almost white
    [0.025, '#ffcc99'],   # Light peach
    [0.1, '#ff9966'],     # Light orange
    [0.3, '#ff6633'],     # Orange
    [0.5, '#cc66ff'],     # Light purple
    [0.75, '#9933ff'],    # Purple
    [1.0, '#6600cc']      # Deep purple
]

# Create the choropleth map
fig = px.choropleth(df, 
                    locations="iso_alpha",
                    locationmode="ISO-3",
                    color="Expert_Response_%",
                    hover_name="Country",
                    hover_data={'Expert_Response_%': ':.2f', 'iso_alpha': False},
                    color_continuous_scale=purple_orange_scale,
                    range_color=[1, 36.46],
                    labels={'Expert_Response_%': 'Experts Responses %'}
                    )

# Focus the map on Africa
fig.update_geos(
    scope="africa",
    showcountries=True,
    countrycolor="lightgray",
    showcoastlines=True,
    coastlinecolor="darkgray",
    projection_type="natural earth",
    bgcolor="white",
    showland=True,
    landcolor='#e8e8e8',
    showocean=True,
    oceancolor='white',
    showlakes=False,
    showrivers=False
)

# Add country name labels to the map
for country, response in zip(df['Country'], df['Expert_Response_%']):
    if country in country_coords:
        # Different font sizes based on response rate
        if response > 10:
            font_size = 11
            font_color = 'white'
            font_weight = 'bold'
        elif response > 5:
            font_size = 9
            font_color = 'black'
            font_weight = 'normal'
        else:
            font_size = 8
            font_color = 'black'
            font_weight = 'normal'
        
        # Short name for DRC
        display_name = 'DRC' if country == 'Democratic Republic of the Congo' else country
        
        fig.add_trace(go.Scattergeo(
            lon=[country_coords[country]['lon']],
            lat=[country_coords[country]['lat']],
            text=display_name,
            mode='text',
            textfont=dict(size=font_size, color=font_color),
            showlegend=False,
            hoverinfo='skip'
        ))

# Function to get color from scale
def get_color_for_value(value, min_val=1, max_val=36.46):
    normalized = (value - min_val) / (max_val - min_val)
    # Simplified color mapping
    if normalized > 0.75:
        return '#6600cc'  # Deep purple
    elif normalized > 0.5:
        return '#9933ff'  # Purple
    elif normalized > 0.3:
        return '#cc66ff'  # Light purple
    elif normalized > 0.1:
        return '#ff6633'  # Orange
    elif normalized > 0.025:
        return '#ff9966'  # Light orange
    else:
        return '#ffcc99'  # Light peach

# Create color legend table
df_sorted = df.sort_values('Expert_Response_%', ascending=False)
df_sorted['Color'] = df_sorted['Expert_Response_%'].apply(lambda x: get_color_for_value(x))

# Create table trace
table_trace = go.Table(
    header=dict(
        values=['<b>Country</b>', '<b>Response %</b>', '<b>Color</b>'],
        align='left',
        font=dict(size=11, color='white'),
        fill_color='#2c3e50',
        height=25
    ),
    cells=dict(
        values=[
            df_sorted['Country'].tolist(),
            [f"{x:.2f}%" for x in df_sorted['Expert_Response_%'].tolist()],
            ['●' * 3 for _ in range(len(df_sorted))]  # Color dots
        ],
        align=['left', 'center', 'center'],
        font=dict(size=10, color=['black', 'black', df_sorted['Color'].tolist()]),
        fill_color=['white', 'white', 'white'],
        height=22
    ),
    columnwidth=[150, 80, 50]
)

# Update layout
fig.update_layout(
    title={
        'text': "<b>Expert Response Distribution Across African Countries</b>",
        'y': 0.98,
        'x': 0.5,
        'xanchor': 'center',
        'yanchor': 'top',
        'font': dict(size=24, family="Arial", color='#2c3e50')
    },
    geo=dict(
        showframe=False,
        bgcolor="white",
    ),
    width=1400,
    height=1000,
    margin={"r": 100, "t": 100, "l": 50, "b": 100},
    paper_bgcolor="white",
    font=dict(family="Arial", size=14),
    coloraxis_colorbar=dict(
        title=dict(text="Experts Responses %", font=dict(size=14)),
        tickmode="array",
        tickvals=[1.04, 5, 10, 15, 20, 25, 30, 36.46],
        ticktext=['1.04', '5', '10', '15', '20', '25', '30', '36.46'],
        thickness=25,
        len=0.6,
        x=0.92,
        y=0.5,
        yanchor="middle",
        tickfont=dict(size=12)
    )
)

# Add annotation
fig.add_annotation(
    text="<i>Countries labeled on map. Higher response rates shown in purple, lower in orange/peach</i>",
    xref="paper", yref="paper",
    x=0.5, y=0.02,
    showarrow=False,
    font=dict(size=12, color="#7f8c8d", family="Arial"),
    xanchor='center'
)

# Show the interactive map
fig.show()

# Save outputs
fig.write_html("africa_expert_responses_map_labeled.html")
print("✓ Interactive map saved as 'africa_expert_responses_map_labeled.html'")

# Save as PNG (requires kaleido)
try:
    fig.write_image("africa_expert_responses_map_labeled.png", scale=2, width=1400, height=1000)
    print("✓ Static PNG saved as 'africa_expert_responses_map_labeled.png'")
except:
    print("! To save as PNG, install kaleido: pip install kaleido")

# Create a separate figure with just the legend table for reference
fig_table = go.Figure(data=[table_trace])
fig_table.update_layout(
    title="<b>Country Response Rates - Color Legend</b>",
    width=500,
    height=800,
    margin=dict(l=20, r=20, t=60, b=20),
    paper_bgcolor="white"
)

# Save the table separately
fig_table.show()
fig_table.write_html("africa_response_table.html")
print("✓ Table saved as 'africa_response_table.html'")

try:
    fig_table.write_image("africa_response_table.png", scale=2)
    print("✓ Table PNG saved as 'africa_response_table.png'")
except:
    pass

# Print color-coded summary
print("\n" + "="*60)
print("COLOR-CODED COUNTRY SUMMARY")
print("="*60)
print("\n🟣 DEEP PURPLE (Highest Response >30%):")
for _, row in df_sorted[df_sorted['Expert_Response_%'] > 30].iterrows():
    print(f"  • {row['Country']}: {row['Expert_Response_%']:.2f}%")

print("\n🟪 PURPLE (High Response 10-30%):")
for _, row in df_sorted[(df_sorted['Expert_Response_%'] > 10) & (df_sorted['Expert_Response_%'] <= 30)].iterrows():
    print(f"  • {row['Country']}: {row['Expert_Response_%']:.2f}%")

print("\n🟠 ORANGE (Medium Response 5-10%):")
for _, row in df_sorted[(df_sorted['Expert_Response_%'] > 5) & (df_sorted['Expert_Response_%'] <= 10)].iterrows():
    print(f"  • {row['Country']}: {row['Expert_Response_%']:.2f}%")

print("\n🟡 LIGHT ORANGE/PEACH (Low Response <5%):")
count = 0
for _, row in df_sorted[df_sorted['Expert_Response_%'] <= 5].iterrows():
    if count < 5:  # Show first 5 only
        print(f"  • {row['Country']}: {row['Expert_Response_%']:.2f}%")
        count += 1
print(f"  ... and {len(df_sorted[df_sorted['Expert_Response_%'] <= 5]) - 5} more countries")
print("="*60)