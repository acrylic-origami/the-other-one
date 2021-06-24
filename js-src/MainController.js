import React from 'react';
import { Map, Marker, TileLayer, Polyline, Popup, Tooltip , ZoomControl } from 'react-leaflet';
import { latLngBounds, latLng, divIcon } from 'leaflet';
import { decode } from '@mapbox/polyline';
import Q from 'q';
import { Base64 } from 'js-base64';

const RANDALL = [42.2377016, -93.6014727];
const MAG_PREFIXES = [ [1E12, 'T'],  [1E9, 'B'], [1E6, 'M'], [1E3, 'k'], ]

function fromURL() {
	const U = new URLSearchParams(window.location.search);
	const m_term0 = U.get('q');
	return {
		term: m_term0 ? Base64.decode(m_term0) : null,
	}
}

function plain_format_place(p) {
	return `${p.place_name}${p.admin1_name ? `, ${p.admin1_name}` : ''}, ${p.country_code}`;
}
function mag_num(n) {
	for(const [lim, prefix] of MAG_PREFIXES) {
		if(n > lim) {
			return `${(n / lim).toFixed(2)}${prefix}`
		}
	}
	return n.toString()
}

export default class extends React.Component {
	constructor(props) {
		super(props);
		this.search_bar_ref = React.createRef();
		this.uri_stash = React.createRef();
		
		const { term } = fromURL();
		
		this.state = {
			term: term || "",
			places: [],
			selected_place: null,
			n_request: +(term !== null),
			n_fulfilled: 0,
			request: null,
			show_table: true,
			err: null,
			copying: false
		};
	}
	componentDidMount() {
		this.search_bar_ref.current.focus();
		
		window.addEventListener('popstate', e => {
			const { term } = fromURL();
			this.setState({ term });
			this.handle_term(term, false);
		});
		const { term } = fromURL();
		this.handle_term(term, false);
	}
	fail = (e) => {
		this.setState(({ n_fulfilled }) => ({ err: [e.message, false], n_fulfilled: n_fulfilled + 1 }));
	}
	handle_term = (term, push_history) => {
		if(term !== null) {
			if(push_history)
				history.pushState({}, `route-${term}-done`, `?q=${Base64.encode(term)}`);
			
			const F = new FormData();
			F.set('term', term);
			this.setState({
				request: fetch('/q', {
						method: 'POST',
						// headers: new Headers({ 'content-type': 'application/json' }),
						body: F
					})
						.then(res => res.json())
						.then(places => {
							this.setState(({ n_fulfilled }) => ({
								n_fulfilled: n_fulfilled + 1
							}))
							if(places.length > 0) {
								this.setState({
									places: places.map(p_ => Object.assign(p_, { latlng: latLng(p_.lat, p_.lon), pop: parseInt(p_.pop) })),
									selected_place: null,
								});
							}
							else {
								this.fail(new Error(`City "${term}" was not found.`))
							}
						})
						.catch(e => console.log(e) || this.fail(new Error('Could not handle query term.')))
			});
		}
	}
	copyURI = () => {
		const past_focus = document.activeElement;
		this.uri_stash.current.select();
		document.execCommand('copy');
		past_focus.focus();
		this.setState({ copying: true });
	}
	componentDidUpdate(_, l) {
		// console.log(this.state.n_request, this.state.n_fulfilled);
		if(this.state.err !== null && !this.state.err[1]) {
			const this_err = this.state.err[0];
			this.setState(({ err }) => err !== null && (err[0] === this_err ? { err: [this_err, true] } : {}));
			setTimeout(_ => this.setState(({ err }) => err !== null && (err[0] === this_err ? { err: null } : {})), 4000);
		}
		if(this.state.copying)
			setTimeout(_ => this.setState({ copying: false }), 1000);
		
		if(l.n_request != this.state.n_request) {
			this.handle_term(this.state.term, true);
		}
	}
	
	handleMarkerClick = selected_place => this.setState({
		selected_place
	});
	
	render = _ => {
		const total_pop = this.state.places.map(p => p.pop).reduce((a, b) => a + b, 0);
		return <div>
			<Map center={this.state.places.length > 0
							? (this.state.places.length > 1
								? (
										this.state.selected_place !== null && this.state.selected_place < this.state.places.length
											? this.state.places[this.state.selected_place].latlng
											: null
									)
								: this.state.places[0].latlng)
							: RANDALL}
			     style={{ height: '100%' }}
			     zoom={this.state.places.length > 1 ? undefined : 13}
			     zoomControl={false}
			     bounds={this.state.places.length > 1 ? latLngBounds(this.state.places.map(p => p.latlng)).pad(0.13) : null /* && this.state.selected_place === null */}>
				<TileLayer
					url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
					attribution="&copy; <a href=&quot;http://osm.org/copyright&quot;>OpenStreetMap</a> contributors"
				/>
				{
					this.state.places.map((p, k) =>
						<Marker position={p.latlng} key={k} onClick={_e => this.handleMarkerClick(k)} icon={divIcon({ html: `
							<div id="${k === 0 ? 'first_place' : ''}" style="font-size:${0.8 + (p.pop / total_pop) * 0.6}em;" class="${k === this.state.selected_place ? 'selected' : ''}"><span class="ordinal">${k+1}</span><span class="place-name">${plain_format_place(p)}</span></div>
						`, className: 'place-icon' })} />
					)
				}
				<ZoomControl position="topright" />
			</Map>
			<div id="controls">
				<div id="context_wrapper">
					<ul id="context_bar">
						<li className="boxed"><a href="https://xkcd.com/2480/" title="XKCD comic 2480 (No, the Other One)" target="_blank">XKCD 2480</a></li>
						<li className="boxed"><a href="https://lam.io/projects/x2480" target="_blank">Data Sources and Processing</a></li>
						<li className="boxed">
							{ this.state.copying ?
								"Copied!" :
								<a href="#" onClick={this.copyURI}>Share this place (copy URI)</a>
							}
						</li>
						<li className="boxed">
							<a href="https://github.com/acrylic-origami/the-other-one" target="_blank"><span className="github">&nbsp;</span></a>
						</li>
					</ul>
				</div>
				<input type="text" className="hidden" ref={this.uri_stash} value={window.location.href} onChange={_ => {}} />
				<div>
					<form onSubmit = {e => this.setState(({ n_request }) => ({ n_request: n_request + 1 })) || e.preventDefault()} id="query">
						<input type="text"
							id="query_text"
							ref={this.search_bar_ref}
							onChange={e => this.setState({ term: e.target.value })}
							className={this.state.err && 'err'}
							value={this.state.term}
							placeholder='Search city name (e.g. Cairo, Washington, Bombay, La Soledad)' />
						{ (this.state.n_request > this.state.n_fulfilled) && <div className="lds-ellipsis"><div></div><div></div><div></div><div></div></div> }
					</form>
				</div>
				{ this.state.places.length > 0 ? 
					<div id="results_pane" className="pane">
						{
							this.state.places.length === 1
								? <span><span className="first-place-name">{plain_format_place(this.state.places[0])}</span> is unique in the world.</span>
								: (() => {
									const selected_idx = this.state.selected_place !== null && this.state.selected_place < this.state.places.length
										? this.state.selected_place
										: 0;
									return <div id="stats_container">
											<div className="first-place-name">{
												plain_format_place(this.state.places[selected_idx])}</div>
											<hr />
											<div className="first-place-pop">
												Pop. {mag_num(this.state.places[selected_idx].pop)}
											</div>
											<hr />
											<div className="first-place-multiplier-container">
												<div className="first-place-multiplier">{(this.state.places[selected_idx].pop / (total_pop - this.state.places[selected_idx].pop)).toFixed(2)}x</div>
												<div>all other <em className="place-name">{this.state.places[selected_idx].place_name}</em>s combined.</div>
											</div>
											<div><input type="checkbox" id="show-table" onChange={e => this.setState({ show_table: e.target.checked })} checked={ this.state.show_table } /><label htmlFor="show-table">Show table</label></div>
										</div>;
							})()
						}
						{ this.state.show_table && this.state.places.length > 0
							? <div>
									<div id="places_table_container">
										<table id="places_table" cellSpacing="0" cellPadding="0">
											<thead>
												<tr>
													<td></td>
													<td>Name</td>
													<td>Province</td>
													<td>Country</td>
													<td>Pop.</td>
													<td>Pop. %</td>
												</tr>
											</thead>
											<tbody>
												{this.state.places.map((p, k) => <tr className={this.state.selected_place === k || (k === 0 && this.state.selected_place === null) ? 'selected' : ''} onClick={_e => this.handleMarkerClick(k)} key={p.geonameid}>
														<td>{k + 1}</td>
														<td>{p.place_name}</td>
														<td>{p.admin1_name}</td>
														<td>{p.country_name}</td>
														<td>{mag_num(p.pop)}</td>
														<td>{(p.pop / total_pop * 100).toFixed(2)}%</td>
													</tr>)}
											</tbody>
										</table>
									</div>
								</div>
							: null }
					</div>
					: null }
				
				{ this.state.err && <div id="err_container" className="pane">
						{this.state.err[0]}
					</div> }
			</div>
		</div>;
	}
}
