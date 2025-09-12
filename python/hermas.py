import plotly.express as px
import plotly.graph_objects as go
import pandas as pd

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
    # ISO-3 country codes to avoid deprecation warning
    'iso_alpha': ['GHA', 'NGA', 'LBR', 'CMR', 'ETH', 'KEN', 
                  'ZAF', 'SLE', 'COD', 'LSO', 'GAB', 'ZWE', 
                  'MDG', 'TGO', 'ERI', 'SSD', 'BWA', 'BEN', 
                  'MWI', 'BFA', 'MOZ', 'TZA', 'EGY', 'MAR']
}

df = pd.DataFrame(data)

# Create a custom color scale similar to your reference image (purple to orange gradient)
purple_orange_scale = [
    [0.0, '#f5f5f5'],     # Almost white
    [0.025, '#ffcc99'],   # Light peach
    [0.1, '#ff9966'],     # Light orange
    [0.3, '#ff6633'],     # Orange
    [0.5, '#cc66ff'],     # Light purple
    [0.75, '#9933ff'],    # Purple
    [1.0, '#6600cc']      # Deep purple
]

# Create the choropleth map using ISO-3 codes to avoid deprecation
fig = px.choropleth(df, 
                    locations="iso_alpha",  # Using ISO-3 codes
                    locationmode="ISO-3",    # Using ISO-3 mode instead of country names
                    color="Expert_Response_%",
                    hover_name="Country",
                    hover_data={'Expert_Response_%': ':.2f', 'iso_alpha': False},  # Hide ISO codes in hover
                    color_continuous_scale=purple_orange_scale,
                    range_color=[1, 36.46],  # Set range from min to max of your data
                    labels={'Expert_Response_%': 'Experts Responses %'}
                    )

# Focus the map on Africa with styling
fig.update_geos(
    scope="africa",
    showcountries=True,
    countrycolor="lightgray",
    showcoastlines=True,
    coastlinecolor="darkgray",
    projection_type="natural earth",
    bgcolor="white",
    showland=True,
    landcolor='#e8e8e8',  # Light gray for countries without data
    showocean=True,
    oceancolor='white',
    showlakes=False,
    showrivers=False
)

# Update layout for academic/professional style (FIXED: removed titleside)
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
    width=1200,
    height=1000,
    margin={"r": 100, "t": 100, "l": 50, "b": 100},
    paper_bgcolor="white",
    font=dict(family="Arial", size=14),
    coloraxis_colorbar=dict(
        title=dict(text="Experts Responses %", font=dict(size=14)),  # Correct way to set title
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

# Add annotation about the data
fig.add_annotation(
    text="<i>Countries with white dots have from 4%-36.46% response rates</i>",
    xref="paper", yref="paper",
    x=0.5, y=0.02,
    showarrow=False,
    font=dict(size=12, color="#7f8c8d", family="Arial"),
    xanchor='center'
)

# Show the interactive map
fig.show()

# Save as HTML for interactive viewing
fig.write_html("africa_expert_responses_map.html")
print("✓ Interactive map saved as 'africa_expert_responses_map.html'")

# Save as static image (requires: pip install kaleido)
try:
    # Save as high-quality PNG
    fig.write_image("africa_expert_responses_map.png", scale=2, width=1200, height=1000)
    print("✓ Static PNG image saved as 'africa_expert_responses_map.png'")
    
    # Also save as other formats if needed
    fig.write_image("africa_expert_responses_map.pdf", width=1200, height=1000)
    print("✓ PDF version saved as 'africa_expert_responses_map.pdf'")
    
    # Save a higher resolution version for publications
    fig.write_image("africa_expert_responses_map_hires.png", scale=3, width=1800, height=1500)
    print("✓ High-resolution PNG saved as 'africa_expert_responses_map_hires.png'")
    
except Exception as e:
    print(f"! Error saving images: {e}")
    print("! To save as PNG/PDF, install kaleido: pip install kaleido")

# Print summary statistics
print("\n" + "="*60)
print("EXPERT RESPONSE STATISTICS - AFRICAN COUNTRIES")
print("="*60)
print(f"Total countries surveyed: {len(df)}")
print(f"\nTop 5 countries by response rate:")
for i, row in df.nlargest(5, 'Expert_Response_%').iterrows():
    print(f"  {row['Country']:<25} {row['Expert_Response_%']:.2f}%")
print(f"\nSummary:")
print(f"  • Highest response: Ghana ({df['Expert_Response_%'].max():.2f}%)")
print(f"  • Lowest response: {df['Expert_Response_%'].min():.2f}%")
print(f"  • Mean response: {df['Expert_Response_%'].mean():.2f}%")
print(f"  • Median response: {df['Expert_Response_%'].median():.2f}%")
print("="*60)